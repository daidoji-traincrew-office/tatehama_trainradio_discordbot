require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { checkUserInGuild } = require('../utils/discord');

const router = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

router.get('/discord/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Code not provided');
  }

  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('scope', 'identify guilds guilds.members.read');

    const response = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const accessToken = response.data.access_token;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = userResponse.data;
    const GUILD_ID = process.env.DISCORD_GUILD_ID;

    const isMember = await checkUserInGuild(user.id, GUILD_ID);

    if (!isMember) {
      return res.status(403).send('User is not a member of the required server.');
    }

    return res.redirect(`tatehama://auth?discord_id=${user.id}`);
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    return res.status(500).send('OAuth failed');
  }
});

module.exports = router;