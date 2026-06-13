import cron from "node-cron";
import { DAYS_BEFORE_DELETION } from "../config/serverConfig.js";
import { getPrisma } from "../service/prismaService.js";
import { getRedisClient } from "../service/redisService.js";
import { collectMd5SetFromBlocks } from "../service/s3RefService.js";
import { logger } from "../utils/logger.js";

// Redis 기반 분산 락 설정
// TTL을 5분으로 설정: 크론 실행 도중 서버가 강제 종료되더라도 5분 후 락이 자동 해제됨
const LOCK_KEY = "cron:purgeDeletedBoards";
const LOCK_TTL_SEC = 300;

export function registerPurgeDeletedBoardsJob() {
    console.log("\x1b[32m✔\x1b[0m 게시글 삭제 CRON 등록 완료");
    cron.schedule(
        "10 4 * * *",
        async () => {
            const prisma = getPrisma();
            let count = 0;
            const locked = await tryAcquireLock();
            if (!locked) {
                // 다른 인스턴스가 이미 실행 중
                return;
            }
            try {
                const cutoff = new Date(Date.now() - DAYS_BEFORE_DELETION * 24 * 60 * 60 * 1000);

                while (true) {
                    const targets = await prisma.board.findMany({
                        where: {
                            is_deleted: 1,
                            updated_dt: { lte: cutoff },
                        },
                        select: { id: true, board_content: true },
                        take: 100,
                        orderBy: { updated_dt: "asc" },
                    });

                    if (targets.length === 0) {
                        break;
                    }

                    for (const b of targets) {
                        await prisma.$transaction(async tx => {
                            const md5s = [
                                ...collectMd5SetFromBlocks(b.board_content, process.env.AWS_S3_URL),
                            ];

                            if (md5s.length) {
                                await tx.file.updateMany({
                                    where: { file_md5: { in: md5s }, ref_count: { gt: 0 } },
                                    data: { ref_count: { decrement: 1 } },
                                });
                            }

                            await tx.board.delete({ where: { id: b.id } });
                            count++;
                        });
                    }
                }
                logger().info(`[cron]게시글 삭제 동작 완료! 삭제 : ${count}개 `);
            } catch (err) {
                logger().warn(
                    "[cron][registerPurgeDeletedBoardsJob]게시글 삭제중 오류가 발생했습니다. 에러:",
                    err
                );
            } finally {
                // 락 해제: Redis DEL은 어느 인스턴스/커넥션에서 호출해도 동일하게 동작
                await releaseLock();
            }
        },
        { timezone: "Asia/Seoul" }
    );
}

// pm2가 클러스터 모드기에 두번 연속 cron이 동작하는걸 막아야함
// [변경 이유] MySQL GET_LOCK은 특정 DB 커넥션 세션에 종속됨.
// Prisma는 커넥션 풀을 사용하므로 락을 잡은 커넥션과 해제하는 커넥션이
// 다른 커넥션일 수 있어 RELEASE_LOCK이 0(실패)을 반환하고 락이 영구히 물림.
// Redis SET NX는 키(Key) 기반으로 동작하므로 어떤 인스턴스/커넥션에서 호출해도 안전하게 동작함.
async function tryAcquireLock() {
    const redis = getRedisClient();
    // NX: 키가 없을 때만 설정 (원자적 연산) / EX: TTL 설정으로 프로세스 강제 종료 시 자동 해제
    const result = await redis.set(LOCK_KEY, "1", { NX: true, EX: LOCK_TTL_SEC });
    return result !== null; // null이면 이미 락이 있는 것
}

async function releaseLock() {
    const redis = getRedisClient();
    try {
        await redis.del(LOCK_KEY);
    } catch (err) {
        // DEL 실패해도 TTL(5분) 후 자동 만료되므로 치명적이지 않음
        logger().warn("[cron] Redis 락 해제 실패 (TTL로 자동 만료됨)", err);
    }
}
