import cron from 'node-cron';
import { logger } from '../../src/utils/logger.js';

let userCache = new Map();
let cronJob = null;

/**
 * @param {*} client 디스코드 Client 객체
 * @param {Array} channels 탐색 채널 ID 배열 (Azure Key Vault에서 가져온 값)
 */
async function refreshUserCache(client, channels) {
    try {
        const newCache = new Map();

        for (const channelId of channels) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (!channel) {
                    logger().warn(`유저 캐싱 중: 채널을 찾을 수 없음: ${channelId}`);
                    continue;
                }

                const guild = channel.guild;
                if (!guild) {
                    logger().warn(`유저 캐싱 중: 채널에 길드 정보 없음: ${channelId}`);
                    continue;
                }

                const members = await guild.members.fetch();

                members.forEach(member => {
                    // Map은 중복 제거 기능이 있음
                    newCache.set(member.user.id, member.displayName);
                });
            } catch (err) {
                logger().error(`유저 캐싱 중: 채널(${channelId}) 처리 중 오류:`, err.message);
            }
        }

        userCache = newCache;
        console.log('유저 캐싱 중: 유저 캐시 갱신 완료, 총 인원:', userCache.size);
    } catch (err) {
        logger().error('유저 캐싱 중: 전체 갱신 중 오류:', err.message);
    }
}

/**
 * 크론 작업 시작
 * @param {*} client 디스코드 Client 객체
 * @param {Array} channels 채널 ID 배열
 * @param {string} cronExpr 크론 표현식 (기본: 30분마다 실행)
 */
export async function startUserCacheCron(client, channels, cronExpr = '*/30 * * * *') {
    await refreshUserCache(client, channels);

    cronJob = cron.schedule(cronExpr, async () => {
        await refreshUserCache(client, channels);
    });
}

/** 캐시된 유저 목록 가져오기 */
export function getDiscordUserList() {
    return userCache;
}
