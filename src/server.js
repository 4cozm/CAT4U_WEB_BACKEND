//서버 실행을 담당 (app.listen() 호출, 포트 바인딩, 로깅 등)
import app from './app.js';
import { importVaultSecrets } from './config/envConfig.js';
await importVaultSecrets(); // Azure Key vault 통한 환경변수 로드

app.listen(3000, () => {
    console.log('🚀서버 실행 중');
});
