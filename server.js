const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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
  const code = req.query.code;
  if (!code) {
    // 認証コードがない場合は、エラー情報を付けてリダイレクト
    return res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=missing_code`);
  }

  try {
    // アクセストークンに交換
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

    // ユーザー情報を取得
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const discordUser = userResponse.data;

    // サーバー参加状況を確認
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

      // 成功時はJWTトークンを付けてリダイレクト
      res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?token=${appToken}`);

    } catch (guildError) {
      // サーバーに参加していない場合
      if (guildError.response && guildError.response.status === 404) {
        res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=not_in_guild`);
      } else {
        res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=guild_check_failed`);
      }
    }

  } catch (error) {
    // その他の認証エラー
    console.error('[Mobile Auth Error]', error.response ? error.response.data : error.message);
    res.redirect(`${APP_CALLBACK_SCHEME}://auth-success?error=auth_failed`);
  }
});


//================================================================
// 2. PCアプリ (C#)用：認証コードを受け取り、JWTを返すAPIエンドポイント
//================================================================
app.post('/api/pc-auth', async (req, res) => {
    // C#アプリから送られてくるリクエストのボディからcodeを取得
    const { code } = req.body; 

    if (!code) {
        return res.status(400).json({ success: false, message: 'Authorization code is required.' });
    }

    try {
        // アクセストークンに交換 (リダイレクトURIはPCアプリで指定したものと一致させる)
        const redirectUriForPc = 'http://localhost:8000/callback/'; // C#アプリで使うポートに合わせる
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

        // ユーザー情報を取得
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const discordUser = userResponse.data;

        // サーバー参加状況を確認
        try {
            const memberResponse = await axios.get(
                `https://discord.com/api/guilds/${REQUIRED_GUILD_ID}/members/${discordUser.id}`,
                { headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` } }
            );
            const guildNickname = memberResponse.data.nick;

            // JWTを生成
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

            // JWTをJSONレスポンスとしてC#アプリに直接返す
            res.json({ success: true, token: appToken });

        } catch (guildError) {
            // サーバーに参加していない
            res.status(403).json({ success: false, message: '指定されたサーバーに参加していません。' });
        }
    } catch (error) {
        // その他の認証エラー
        console.error('[PC Auth Error]', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Discord認証中にエラーが発生しました。' });
    }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
