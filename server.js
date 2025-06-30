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
  if (!code) {
    return res.status(400).send('Error: Missing authorization code');
  }

  try {
    // 1. 認証コードをアクセストークンに交換
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

    // 2. ユーザー情報を取得
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const discordUser = userResponse.data;

    // 3. Bot権限で、ユーザーが指定サーバーに参加しているか確認
    try {
      await axios.get(
        `https://discord.com/api/guilds/${REQUIRED_GUILD_ID}/members/${discordUser.id}`,
        { headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      
      // 4. サーバーに参加していたら、アプリ用のJWTを生成
      const appToken = jwt.sign(
        { userId: discordUser.id, username: discordUser.username },
        JWT_SECRET,
        { expiresIn: '7d' } // トークンの有効期限（例: 7日間）
      );

      // 5. JWTを付けてFlutterアプリにリダイレクト
      res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?token=${appToken}`);

    } catch (guildError) {
      // サーバーに参加していなかった場合のエラー処理
      res.redirect(`${APP_CALLBACK_SCHEME}://auth-failure?error=not_in_guild`);
    }

  } catch (error) {
    // その他の認証エラー
    console.error('Auth Error:', error.response ? error.response.data : error.message);
    res.redirect(`${APP_CALLBACK_SCHEME}://auth-failure?error=auth_failed`);
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});