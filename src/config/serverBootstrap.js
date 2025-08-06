// 서버 시작시 필요한 모듈 설정
import { deployFrontendOnStartup } from '../service/githubArtifactService.js';
import { connectWithRetry } from '../service/mySqlService.js';
import { initRedis } from '../service/redisService.js';
import { setDiscordHook } from '../utils/SendDiscordMsg.js';
import { importVaultSecrets } from './envConfig.js';

export default async function initializeServer() {
    try {
        await importVaultSecrets(); // Azure Key Vault 로드
        await setDiscordHook(); // Discord Hook 초기화
        await connectWithRetry(true); // MySQL 연결
        await initRedis(); //redis 연결
        await deployFrontendOnStartup(); // 프론트엔드 페이지 최신버전 업데이트
    } catch (error) {
        console.error('🚨 서버 초기화 중 오류 발생:', error);
        process.exit(1);
    }
}
