//서버 실행을 담당 (app.listen() 호출, 포트 바인딩, 로깅 등)
import app from './app.js';
import { importVaultSecrets } from './config/envConfig.js';
import { connectWithRetry } from './service/mySqlService.js';
import { setDiscordHook } from './utils/logger.js'; //👀 logger가 디스코드 웹후크 권한을 가질 필요가 없기에 기능을 SendDiscordMessage로 옮기는게 적절함(난 손안댔음 직접 해보세용)
await importVaultSecrets(); // Azure Key vault 통한 환경변수 로드
await connectWithRetry(true); //MySQL 연결 , 서버 시작 시점에 연결 불가시 자동 종료
await setDiscordHook();

app.listen(3000, async () => {
    console.log('🚀서버 실행 중');
});
