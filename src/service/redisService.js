import ora from 'ora';
import { createClient } from 'redis';
import { getRedisOptions } from '../config/redisOptions.js';
import { logger } from '../utils/logger.js';

let redisClient;

export async function initRedis() {
    const spinner = ora('Redis 서버에 연결 중...').start();

    try {
        const options = getRedisOptions();
        redisClient = createClient(options);

        redisClient.on('error', err => {
            logger().error('Redis 에서 에러 발생', err);
        });

        redisClient.on('reconnecting', () => {
            logger().warn('Redis 재연결 시도 중...');
        });

        await redisClient.connect();

        spinner.succeed('Redis 연결 성공');
    } catch (error) {
        spinner.fail(`Redis 연결 실패: ${error.message}`);
        process.exit(1);
    }
}

export function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client가 초기화 되지 않은 상태로 호출되었습니다');
    }
    return redisClient;
}
