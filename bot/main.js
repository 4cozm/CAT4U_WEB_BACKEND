import { Client, Events, GatewayIntentBits } from 'discord.js';
import getCallerName from '../src/utils/getCallerName.js';
import { logger } from '../src/utils/logger.js';
import { startUserCacheCron } from './jobs/guildUserCache.js';

let discordClient = null;

export async function initDiscordClient() {
    try {
        const token = process.env.DISCORD_TOKEN;
        const channels = process.env.DISCORD_CHANNELS;
        if (!token) {
            console.error('디스코드 봇 초기화 중 에러 발생 : env에서 Token 정보 없음');
            process.exit(0);
        }

        discordClient = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
        });

        discordClient.login(token);

        discordClient.on(Events.ClientReady, readyClient => {
            console.log(`디스코드 봇 로그인 완료 : ${readyClient.user.tag}`);
        });

        await startUserCacheCron(discordClient, channels); // 순서에 맞게 cron 작업도 실시
    } catch (e) {
        logger().error('서버 시작 시 디스코드 봇 초기화 오류', e.message);
    }
}

export function getDiscordClient() {
    if (!discordClient) {
        logger().warn(
            `디스코드 클라이언트가 초기화되지 않은 상태에서 호출됨. 호출 함수: ${getCallerName()}`
        );
    }
    return discordClient;
}
