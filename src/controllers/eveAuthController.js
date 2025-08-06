import { getSessionConfig } from '../config/serverConfig.js';
import { processCallback } from '../service/eveAuthService.js';
import getRandomUuid from '../utils/getRandomUuid.js';
import { logger } from '../utils/logger.js';

/**
 * EVE 로그인 페이지로 리디렉션하는 컨트롤러
 */
export function redirectToEveLogin(req, res) {
    const clientId = process.env.ESI_CLIENT_ID;
    const redirectUrl = process.env.ESI_CALLBACK_URL;
    const scope = process.env.ESI_SCOPE;

    const state = getRandomUuid(); //state 생성
    req.session.state = state; //세션(redis)에 state 저장

    const authorizeUrl = `https://login.eveonline.com/v2/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(
        redirectUrl
    )}&client_id=${clientId}&scope=${scope}&state=${state}`;

    logger().info(`[EVE ESI] state 생성 및 리디렉션: ${state}, ip=${req.ip}`);

    res.redirect(authorizeUrl);
}

/**
 * EVE 로그인 후 리디렉션된 콜백을 처리하는 컨트롤러
 * - 인증 코드(code)로 access_token 요청
 * - 캐릭터 정보를 얻은 후 JWT 발급
 */
export async function handleCallback(req, res) {
    const code = req.query.code;
    const state = req.query.state;
    const savedState = req.session.state;
    delete req.session.state;

    if (!code) {
        logger().warn(
            `[EVE ESI][콜백] code 없음 | ip=${req.ip} | state=${state} | sessionState=${savedState} | ua=${req.headers['user-agent']}`
        );
        return res.status(400).send('코드 없음');
    }
    if (!state) {
        logger().warn(
            `[EVE ESI][콜백] state 없음 | ip=${req.ip} | code=${code} | sessionState=${savedState} | ua=${req.headers['user-agent']}`
        );
        return res.status(400).send('state 없음');
    }
    if (!savedState) {
        logger().warn(
            `[EVE ESI][콜백] 세션 state 없음 | ip=${req.ip} | code=${code} | state=${state} | ua=${req.headers['user-agent']}`
        );
        return res.status(400).send('세션 state 없음');
    }
    if (state !== savedState) {
        logger().warn(
            `[EVE ESI][콜백] state 불일치 | ip=${req.ip} | code=${code} | state=${state} | sessionState=${savedState} | ua=${req.headers['user-agent']}`
        );
        return res.status(403).send('state 불일치');
    }

    try {
        const token = await processCallback(code, req.ip);

        const redirectUrl =
            process.env.isDev === 'true' ? 'http://127.0.0.1:3000/' : 'https://web.cat4u.store';
        const cookieOption = getSessionConfig();
        res.cookie('access_token', token, cookieOption.COOKIE_OPTIONS);
        logger().info('[EVE ESI] JWT 발급 성공', req.ip);

        res.redirect(redirectUrl);
    } catch (err) {
        logger().warn(`[EVE ESI][콜백] 로그인 중 에러 발생 ${err} | ${req.ip}`);
        res.status(500).send('서버 문제로 인한 로그인 실패');
    }
}
