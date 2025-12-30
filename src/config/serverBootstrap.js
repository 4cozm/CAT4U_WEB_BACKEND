// 서버 시작시 필요한 모듈 설정

import { registerPurgeDeletedBoardsJob } from "../jobs/boardClean.js";
import { startSqsWorker } from "../jobs/sqsWorker.js";
import { buildS3Connection } from "../service/awsS3Client.js";
import { connectWithRetry } from "../service/prismaService.js";
import { initRedis } from "../service/redisService.js";
import { ensureEnvWithDefaults } from "../utils/envFile.js";
import { setDiscordHook } from "../utils/SendDiscordMsg.js";
import { importVaultSecrets } from "./envConfig.js";

export default async function initializeServer() {
    try {
        BigInt.prototype.toJSON = function () {
            //DB의 Big Int 자동 변환
            return this.toString();
        };

        await ensureEnvWithDefaults(); //env 자동 설정
        await importVaultSecrets(); // Azure Key Vault 로드
        await setDiscordHook(); // Discord Hook 초기화
        await connectWithRetry(true); // Prisma 연결
        await initRedis(); //redis 연결
        buildS3Connection(); //AWS S3 객체 생성
        startSqsWorker(); // SQS 워커 구동 * 백그라운드 작업을 위해서 await 없이 구동
        registerPurgeDeletedBoardsJob(); //게시글 정리 CRON
    } catch (error) {
        console.error("🚨 서버 초기화 중 오류 발생:", error);
        process.exit(1);
    }
}
