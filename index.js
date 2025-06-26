require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const crypto = require('crypto');

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const CODE_CHALLENGE_MAP = new Map(); // 一時的に code_verifier を保持するMap

// 認証開始
app.get('/login', (req, res) => {
  const codeVerifier = crypto.randomBytes(64).toString('hex');
  const base64url = (str) =>
    str.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());

  // 一時的に保存（セッションがある場合はそれを使うべき）
  CODE_CHALLENGE_MAP.set(codeChallenge, codeVerifier);

  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent("https://train-radio.tatehama.jp/auth/discord/callback")}&response_type=code&scope=identify%20guilds&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  console.log("🔗 リダイレクトURL:", redirect);
  res.redirect(redirect);
  console.log("🔗 リダイレクトURL:", redirect);
});

// コールバック処理
app.get('/auth/discord/callback', async (req, res) => {
  const codeFromDiscord = req.query.code;
  const codeVerifier = CODE_CHALLENGE_MAP.get(codeFromDiscord);

  if (!codeVerifier) {
    console.error("❌ code_verifier が見つかりませんでした。CODE_CHALLENGE_MAP:", [...CODE_CHALLENGE_MAP.entries()]);
    return res.status(400).send("code_verifier が見つかりませんでした。");
  }

  if (!codeFromDiscord) {
    return res.status(400).send("認証コードが見つかりませんでした。");
  }

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: codeFromDiscord,
        redirect_uri: 'https://train-radio.tatehama.jp/auth/discord/callback',
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.status(500).send("トークンの取得に失敗しました。");
    }

    // ユーザー情報の取得
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = userResponse.data.id;
    console.log("✅ ユーザーID:", userId);

    // BOTが所属しているギルドにユーザーがいるか確認
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log("✅ 対象ギルド:", guild.name, guild.id);
    try {
      await guild.members.fetch(userId);
      console.log("✅ メンバーを取得しました");
      res.send("<html><body style='font-family:sans-serif;text-align:center;margin-top:20%'><h1>✅ サーバー認証が完了しました</h1><p>数秒後にアプリに戻ります...</p><script>setTimeout(()=>{window.location.href='myapp://auth_success';}, 3000)</script></body></html>");
    } catch (memberError) {
      console.error("❌ メンバー取得に失敗:", memberError);
      res.status(403).send("<html><body style='font-family:sans-serif;text-align:center;margin-top:20%'><h1>❌ サーバー認証に失敗しました</h1><p>あなたはこのサーバーに参加していません。</p><script>setTimeout(()=>{window.location.href='myapp://auth_failed';}, 3000)</script></body></html>");
    }

  } catch (error) {
    console.error("❌ Discord認証全体でのエラー:", error.response?.data || error.message);
    res.status(500).send("Discord認証に失敗しました。");
  }
});

// Botログイン
client.once('ready', () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);
});
client.login(process.env.DISCORD_BOT_TOKEN);

app.listen(5000, () => {
  console.log('🚀 認証サーバーが http://localhost:5000 で起動中');
});