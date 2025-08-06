// 서버 시작시 필요한 모듈 설정
import { connectWithRetry } from '../service/mySqlService.js';
import { setDiscordHook } from '../utils/SendDiscordMsg.js';
import { importVaultSecrets } from './envConfig.js';

export default async function initializeServer() {
    try {
        await importVaultSecrets(); // Azure Key Vault 로드
        await connectWithRetry(true); // MySQL 연결
        await setDiscordHook(); // Discord Hook 초기화
    } catch (error) {
        console.error('🚨 서버 초기화 중 오류 발생:', error);
        process.exit(1);
    }
}
