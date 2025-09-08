//서버 실행을 담당 (app.listen() 호출, 포트 바인딩)
import { createApp } from './app.js';
import initializeServer from './config/serverBootstrap.js';

await initializeServer(); //서버 초기 설정
const app = await createApp(); //express 객체 초기화

app.listen(3000, async () => {
    console.log('🚀서버가 시작되었습니다!');
});
