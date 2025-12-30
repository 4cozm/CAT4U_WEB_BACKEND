//SQS 에서 받은 업로드 완료 메세지를 검증하고 업로드 완료 처리 하는 코드
import { logger } from "../utils/logger.js";
import { getPrisma } from "./prismaService.js";

export const processDatabaseUpdate = async (fileMd5, ext, s3Key) => {
    const prisma = getPrisma();
    const isOptimized = s3Key.includes("optimized/");

    try {
        await prisma.$transaction(async tx => {
            // 1. 세션 찾기: 'pending'인 것을 먼저 찾되, 없으면 가장 최근의 'completed'라도 가져옵니다.
            // (최적화 완료 이벤트 때는 이미 세션이 completed일 것이기 때문입니다.)
            const session = await tx.uploadSession.findFirst({
                where: { file_md5: fileMd5 },
                orderBy: { created_at: "desc" }, // 가장 최근 세션 기준
            });

            if (!session) {
                logger().info(`[SQS] 대기 중인 세션이 없습니다 (MD5: ${fileMd5})`);
                return;
            }

            // 2. File 테이블 Upsert
            const finalFile = await tx.file.upsert({
                where: { file_md5: fileMd5 },
                update: {
                    s3_key: s3Key,
                    // optimized 폴더에서 온 메세지는 status를 optimized로 처리
                    status: isOptimized ? "optimized" : "uploaded",
                    extension: ext,
                    need_optimize: isOptimized ? false : s3Key.includes("incoming/"),
                    updated_at: new Date(),
                },
                create: {
                    file_md5: fileMd5,
                    original_name: session.original_name,
                    extension: ext,
                    size: session.size,
                    s3_key: s3Key,
                    need_optimize: !isOptimized,
                    status: isOptimized ? "optimized" : "uploaded",
                },
            });

            // 3. 세션 상태 업데이트 (아직 pending인 것들만 싹 다 completed로)
            if (session.status === "pending") {
                await tx.uploadSession.updateMany({
                    where: { file_md5: fileMd5, status: "pending" },
                    data: {
                        status: "completed",
                        file_id: finalFile.id,
                    },
                });
            }

            logger().info(
                `✅ [DB] 처리 완료: ${s3Key} (FileStatus: ${isOptimized ? "optimized" : "uploaded"})`
            );
        });
    } catch (err) {
        logger().error(`[DB] 트랜잭션 실패: ${fileMd5}`, err);
        throw err;
    }
};
