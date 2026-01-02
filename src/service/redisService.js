import ora from "ora";
import { createClient } from "redis";
import { getRedisOptions } from "../config/redisOptions.js";
import { logger } from "../utils/logger.js";

let redisClient;

export async function initRedis() {
    const spinner = ora("Redis 서버에 연결 중...").start();

    try {
        const options = getRedisOptions();
        redisClient = createClient(options);

        redisClient.on("error", err => {
            logger().error("Redis 에서 에러 발생", err);
        });

        redisClient.on("reconnecting", () => {
            logger().warn("Redis 재연결 시도 중...");
        });

        await redisClient.connect();

        spinner.succeed("Redis 연결 성공");
    } catch (error) {
        spinner.fail(`Redis 연결 실패: ${error.message}`);
        process.exit(1);
    }
}

export function getRedisClient() {
    if (!redisClient) {
        throw new Error("Redis client가 초기화 되지 않은 상태로 호출되었습니다");
    }
    return redisClient;
}

//Feed 관련 캐싱 메서드

export function createFeedCacheUtils() {
    function monthKeyKST(date = new Date()) {
        const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const y = kst.getFullYear();
        const m = String(kst.getMonth() + 1).padStart(2, "0");
        return `${y}${m}`;
    }

    function monthRangeKST(yyyymm) {
        const y = Number(yyyymm.slice(0, 4));
        const m = Number(yyyymm.slice(4, 6)) - 1;

        const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

        // KST 00:00을 UTC instant로 환산
        const start = new Date(Date.UTC(y, m, 1, 0, 0, 0) - KST_OFFSET_MS);
        const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0) - KST_OFFSET_MS);

        return { start, end };
    }

    async function redisGetJson(redis, key) {
        const raw = await redis.get(key);
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    async function redisSetJson(redis, key, value, ttlSec) {
        const raw = JSON.stringify(value);
        return redis.set(key, raw, { EX: ttlSec });
    }

    async function getVersion(redis, verKey) {
        const v = await redis.get(verKey);
        return v ? Number(v) : 1;
    }

    async function withBuildLock(redis, lockKey, workFn) {
        const ok = await redis.set(lockKey, "1", { NX: true, EX: 3 });
        if (ok) {
            try {
                return await workFn();
            } finally {
                // EX가 있어서 굳이 DEL 안 해도 되지만, 빨리 풀면 좋음
                try {
                    await redis.del(lockKey);
                } catch {}
            }
        }

        // 락 못잡았으면 잠깐 기다렸다가(짧게) 캐시 재시도
        await new Promise(r => setTimeout(r, 120));
        return null;
    }

    // 밖에서 쓸 것만 반환
    return {
        monthKeyKST,
        monthRangeKST,
        redisGetJson,
        redisSetJson,
        getVersion,
        withBuildLock,
    };
}
