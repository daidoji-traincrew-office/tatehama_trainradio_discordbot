require('dotenv').config();
const express = require('express');
const { client } = require('./utils/discord');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアとルーティング
app.use('/auth', authRoutes);

// ルート確認用
app.get('/', (req, res) => {
  res.send('🚋 Tatehama Train Radio DiscordBot Server is running');
});

// Discord bot のログイン
client.login(process.env.DISCORD_BOT_TOKEN);

// サーバー起動
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});