import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * 요청 헤더에 담긴 JWT를 검증하는 미들웨어
 */
export function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // 'Bearer <토큰>'
    //logger.info() JWT의 헤더 정보를 읽어서 시도를 로깅 해야함

    if (!token) {
        return res.status(401).json({ message: '토큰이 없습니다.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // 요청 객체에 유저 정보 저장
        logger.info(`[${decoded}] 인증 통과`);
        next(); // 다음 미들웨어로 진행
    } catch (err) {
        logger.info(err);
        return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
    }
}
