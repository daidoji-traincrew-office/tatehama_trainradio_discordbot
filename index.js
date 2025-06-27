require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Discord Bot 初期化
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

// Botインスタンスを他のモジュールでも使えるように設定
app.set('discordClient', client);

// ミドルウェアとルート設定
app.use(express.json());
app.use('/auth', authRoutes);

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 サーバーが http://localhost:${PORT} で起動中`);
});