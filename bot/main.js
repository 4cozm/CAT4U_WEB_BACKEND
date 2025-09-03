import { Client, Events, GatewayIntentBits } from 'discord.js';
import express from 'express';

const token = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.on(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);

const app = express();
const PORT = 3000;

// OAuth2 Redirect Callback 엔드포인트
app.get('/auth/discord/callback', (req, res) => {
    const code = req.query.code;
    res.send('로그인 성공! Code: ' + code);
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running at http://localhost:${PORT}`);
});
