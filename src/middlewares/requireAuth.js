import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export default function requireAuth(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        logger().warn('JWT_SECRET이 로드되지 않았습니다');
    }
    // 프리플라이트 + ESI 콜백만 통과
    if (req.method === 'OPTIONS' || req.path.startsWith('/api/esi/callback')) {
        return next();
    }

    const token = req.cookies?.access_token;

    if (!token) {
        return res.redirect('/api/esi/start');
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch {
        try {
            res.clearCookie('access_token');
        } catch {}
        return res.redirect('/api/esi/start');
    }
}
