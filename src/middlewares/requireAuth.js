import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export default function requireAuth(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        logger().warn('JWT_SECRET이 로드되지 않았습니다');
    }

    // 인증 제외 경로
    const publicPaths = [
        '/api/esi/login', // 로그인 시작
        '/api/esi/callback', // ESI 콜백
    ];

    // OPTIONS 요청 또는 화이트리스트 경로는 통과
    if (req.method === 'OPTIONS' || publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const token = req.cookies?.access_token;

    if (!token) {
        return res.sendStatus(401); // 프론트엔드에서 자동으로 캐치해서 로그인 페이지로 보냄
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch {
        try {
            res.clearCookie('access_token');
        } catch {}
        return res.sendStatus(401); // 프론트엔드에서 자동으로 캐치해서 로그인 페이지로 보냄
    }
}
