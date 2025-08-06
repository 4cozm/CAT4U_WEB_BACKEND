//서버 구동 없이 Express 객체만 반환 , 즉 앱 내부 설정
import express from 'express';
import path from 'path';
import router from './routes/index.js';

const __dirname = path.resolve();
const frontendPath = path.join(__dirname, 'public', 'frontend');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', router);
app.use(express.static(frontendPath));

app.use((req, res) => {
    res.status(404).send('Not Found');
});

export default app;
