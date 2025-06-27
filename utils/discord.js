

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`✅ Discord bot logged in as ${client.user.tag}`);
});

const checkUserInGuild = async (userId, guildId) => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    return member !== undefined;
  } catch (error) {
    console.error('❌ Error checking user in guild:', error);
    return false;
  }
};

module.exports = {
  client,
  checkUserInGuild,
};