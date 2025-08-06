//서버 구동 없이 Express 객체만 반환 , 즉 앱 내부 설정
import express from 'express';
import path from 'path';
import { createSessionMiddleware } from './middlewares/sessionMiddleware.js';
import router from './routes/index.js';

const __dirname = path.resolve();
const frontendPath = path.join(__dirname, 'public', 'frontend');

export async function createApp() {
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', router);
    app.use(express.static(frontendPath));

    const sessionMiddleware = await createSessionMiddleware(); // express와 한몸이라 순서를 명확하게 하기 위해 여기에 작성함
    app.use(sessionMiddleware);

    return app;
}
