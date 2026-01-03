import cron from "node-cron";
import { DAYS_BEFORE_DELETION } from "../config/serverConfig.js";
import { getPrisma } from "../service/prismaService.js";
import { collectMd5SetFromBlocks } from "../service/s3RefService.js";
import { logger } from "../utils/logger.js";

export function registerPurgeDeletedBoardsJob() {
    console.log("\x1b[32m✔\x1b[0m 게시글 삭제 CRON 등록 완료");
    cron.schedule(
        "10 4 * * *",
        async () => {
            const prisma = getPrisma();
            let count = 0;
            const locked = await tryAcquireLock(prisma);
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
                // 락 해제
                await releaseLock(prisma);
            }
        },
        { timezone: "Asia/Seoul" }
    );
}

//pm2가 클러스터 모드기에 두번 연속 cron이 동작하는걸 막아야함
async function tryAcquireLock(prisma) {
    const key = "cron:purgeDeletedBoards";
    const rows = await prisma.$queryRaw`SELECT GET_LOCK(${key}, 0) AS got`;
    return Number(rows?.[0]?.got ?? 0) === 1;
}

async function releaseLock(prisma) {
    const key = "cron:purgeDeletedBoards";
    await prisma.$queryRaw`SELECT RELEASE_LOCK(${key})`;
}
