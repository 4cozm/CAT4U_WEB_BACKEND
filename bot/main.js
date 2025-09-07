import { Client, Events, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import cron from 'node-cron'; // nodejs 스캐줄러

/** 한국시간으로 매일 00시 00분에 실행할 함수 선택
 * cron.schedule('0 0 * * *', Function_name{
 * scheduled: true,
 * timezone: "Asia/Seoul"
 * });
 */

const temp_list = new Map(); // DB 대용
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const channel = '1355412696157130812';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.on(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    GetUserlist();
});

async function GetUserlist() {
    const guild = await client.guilds.fetch(channel);
    const members = await guild.members.fetch();
    members.forEach(member => {
        temp_list.set(member.user.id, member.displayName);
    });

    console.log(temp_list);
}

client.login(token);
