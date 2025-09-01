import jwt from 'jsonwebtoken';
import { redirectToEveLogin } from '../controllers/authController.js';
import { logger } from '../utils/logger.js';

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
    logger().warn('JWT_SECRET이 로드되지 않았습니다');
}

export default function requireAuth(req, res, next) {
    console.log('접속자 감지');
    // 프리플라이트 + ESI 콜백만 통과
    if (req.method === 'OPTIONS' || req.path.startsWith('/api/esi/callback')) {
        return next();
    }

    const token = req.cookies?.access_token;

    if (!token) {
        return redirectToEveLogin(req, res);
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch {
        try {
            res.clearCookie('access_token');
        } catch {}
        return redirectToEveLogin(req, res);
    }
}
