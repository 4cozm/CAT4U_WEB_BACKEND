//서버 구동 없이 Express 객체만 반환 , 즉 앱 내부 설정
import express from 'express';
import router from './routes/index.js';
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

export default app;
