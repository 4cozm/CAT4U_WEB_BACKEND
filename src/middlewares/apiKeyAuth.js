//프론트의 정적 파일이 새로 빌드되면 작동중인 서버에게 업데이트 요청을 보냄. 그때, 아무나 API호출이 불가하도록 간단한 TOKEN으로 방어

import { logger } from '../utils/logger.js';

export function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.ARTIFACT_API_KEY) {
        return next();
    }
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    res.status(403).json({ message: 'Forbidden' });
    logger().warn(`허가되지 않은 아티펙트 접근 IP:${clientIp}`);
}
