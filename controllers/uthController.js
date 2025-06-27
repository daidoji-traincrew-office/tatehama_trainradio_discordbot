


const axios = require('axios');

// 環境変数から必要な情報を取得
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

// Discord APIでアクセストークンを使って所属サーバー情報などを取得
exports.verifyDiscordUser = async (req, res) => {
  const code = req.query.code;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!code) {
    return res.status(400).json({ error: 'Code is missing' });
  }

  try {
    // アクセストークンの取得
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // ユーザー情報の取得
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;

    // サーバー所属確認
    const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const isInGuild = guildsResponse.data.some(guild => guild.id === GUILD_ID);

    if (!isInGuild) {
      return res.status(403).json({ error: 'User is not in the required Discord server.' });
    }

    // 認証成功 → アプリへリダイレクト
    res.redirect(`tatehama://auth?discord_id=${user.id}`);
  } catch (error) {
    console.error('Discord認証エラー:', error.response?.data || error.message);
    res.status(500).json({ error: 'Discord verification failed' });
  }
};