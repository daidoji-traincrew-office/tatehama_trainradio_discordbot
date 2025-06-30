const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// .envファイルから設定を読み込み
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  REQUIRED_GUILD_ID,
  JWT_SECRET,
  APP_CALLBACK_SCHEME
} = process.env;

// Discordからのリダイレクトを受け取るエンドポイント
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  console.log('Received callback from Discord.');

  if (!code) {
    console.error('[ERROR] Missing authorization code from Discord.');
    return res.redirect(`${APP_CALLBACK_SCHEME}://auth-failure?error=missing_code`);
  }
  console.log('-> Authorization code received.');

  try {
    // 1. 認証コードをアクセストークンに交換
    console.log('--> Exchanging code for access token...');
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `http://train-radio.tatehama.jp/auth/discord/callback`,
      })
    );
    const accessToken = tokenResponse.data.access_token;
    console.log('--> Access token obtained.');

    // 2. ユーザー情報を取得
    console.log('--> Fetching user info...');
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const discordUser = userResponse.data;
    console.log(`--> User info fetched for: ${discordUser.username}`);

    // 3. Bot権限で、ユーザーが指定サーバーに参加しているか確認
    console.log(`--> Checking if user ${discordUser.id} is in guild ${REQUIRED_GUILD_ID}...`);
    try {
      const memberResponse = await axios.get(
        `https://discord.com/api/guilds/${REQUIRED_GUILD_ID}/members/${discordUser.id}`,
        { headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      const guildNickname = memberResponse.data.nick;
      console.log('--> User IS a member. Nickname:', guildNickname || '(none)');
      
      // 4. サーバーに参加していたら、アプリ用のJWTを生成
      const appToken = jwt.sign(
        { 
          userId: discordUser.id, 
          username: discordUser.username,
          guildNickname: guildNickname,
          avatar: discordUser.avatar,
        },
        JWT_SECRET,
        { expiresIn: '7d' } 
      );

      // 5. JWTを付けてFlutterアプリにリダイレクト
      console.log('--> Redirecting to app with SUCCESS.');
      res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?token=${appToken}`);

    } catch (guildError) {
      // サーバーに参加していない場合(404)などのエラー
      if (guildError.response && guildError.response.status === 404) {
        console.log('--> User is NOT a member. Redirecting with not_in_guild error.');
        res.redirect(`${APP_CALLBACK_SCHEME}://auth-failure?error=not_in_guild`);
      } else {
        // Botの権限不足、Guild IDの間違いなど、その他のエラー
        console.error('[ERROR] Could not check guild membership:', guildError.message);
        res.redirect(`${APP_CALLBACK_SCHEME}://auth-failure?error=guild_check_failed`);
      }
    }

  } catch (error) {
    console.error('[FATAL ERROR] Main auth flow failed:', error.response ? error.response.data : error.message);
    res.redirect(`${APP_CALLBACK_SCHEME}://auth-failure?error=auth_failed`);
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
