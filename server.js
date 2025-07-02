const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // CORSパッケージをインポート
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// CORSを有効にする (すべてのオリジンからのリクエストを許可)
app.use(cors());
// JSONリクエストのボディを解析するために必要
app.use(express.json());

// .envファイルから設定を読み込み
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  REQUIRED_GUILD_ID,
  JWT_SECRET,
  APP_CALLBACK_SCHEME
} = process.env;

//================================================================
// 1. スマホアプリ用：認証コールバックを受け取るエンドポイント
//================================================================
app.get('/auth/discord/callback', async (req, res) => {
  // (この部分は変更ありません)
  const code = req.query.code;
  if (!code) {
    return res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=missing_code`);
  }
  try {
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
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const discordUser = userResponse.data;
    try {
      const memberResponse = await axios.get(
        `https://discord.com/api/guilds/${REQUIRED_GUILD_ID}/members/${discordUser.id}`,
        { headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      const guildNickname = memberResponse.data.nick;
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
      res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?token=${appToken}`);
    } catch (guildError) {
      if (guildError.response && guildError.response.status === 404) {
        res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=not_in_guild`);
      } else {
        res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=guild_check_failed`);
      }
    }
  } catch (error) {
    console.error('[Mobile Auth Error]', error.response ? error.response.data : error.message);
    res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=auth_failed`);
  }
});


//================================================================
// 2. PCアプリ (C#)用：認証コードを受け取り、JWTを返すAPIエンドポイント
//================================================================
app.all('/api/pc-auth', async (req, res) => {
    console.log(`[PC Auth] Received a ${req.method} request to /api/pc-auth`);

    // ★★★ 'code' の取得方法をより安全な形に修正しました ★★★
    const code = (req.body && req.body.code) ? req.body.code : req.query.code;
    
    if (!code) {
        return res.status(400).json({ success: false, message: 'Authorization code is required.' });
    }
    try {
        const redirectUriForPc = 'http://localhost:8000/callback/';
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUriForPc, 
            })
        );
        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const discordUser = userResponse.data;
        try {
            const memberResponse = await axios.get(
                `https://discord.com/api/guilds/${REQUIRED_GUILD_ID}/members/${discordUser.id}`,
                { headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` } }
            );
            const guildNickname = memberResponse.data.nick;
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
            res.json({ success: true, token: appToken });
        } catch (guildError) {
            res.status(403).json({ success: false, message: '指定されたサーバーに参加していません。' });
        }
    } catch (error) {
        console.error('[PC Auth Error]', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Discord認証中にエラーが発生しました。' });
    }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
