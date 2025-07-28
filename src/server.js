//서버 실행을 담당 (app.listen() 호출, 포트 바인딩, 로깅 등)
import app from './app.js';
import { importVaultSecrets } from './config/envConfig.js';
import { connectWithRetry } from './service/mySqlService.js';
import { setDiscordHook } from './utils/logger.js';
import logger from './utils/logger.js';
await importVaultSecrets(); // Azure Key vault 통한 환경변수 로드
await connectWithRetry(true); //MySQL 연결 , 서버 시작 시점에 연결 불가시 자동 종료
await setDiscordHook();

app.listen(3000, async () => {
    console.log('🚀서버 실행 중');
    logger.error('Error Message Test');
});
