import env from 'dotenv';
import jwt from 'jsonwebtoken';
import { processCallback } from '../service/eveAuth.service.js';

env.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * EVE 로그인 페이지로 리디렉션하는 컨트롤러
 */
export function redirectToEveLogin(req, res) {
    const { CLIENT_ID, REDIRECT_URI } = process.env;
    const scope = process.env.ESI_SCOPE;

    const authorizeUrl = `https://login.eveonline.com/v2/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
    )}&client_id=${CLIENT_ID}&scope=${scope}`;

    res.redirect(authorizeUrl);
}

/**
 * EVE 로그인 후 리디렉션된 콜백을 처리하는 컨트롤러
 * - 인증 코드(code)로 access_token 요청
 * - 캐릭터 정보를 얻은 후 JWT 발급
 */
export async function handleCallback(req, res) {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('코드 없음');
    }

    try {
        const character = await processCallback(code);

        // JWT 토큰 생성
        const token = jwt.sign(
            {
                CharacterID: character.CharacterID,
                CharacterName: character.CharacterName,
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 결과 출력 (나중에 JSON 또는 쿠키로 전환 가능)
        res.send(`
      <h2>${character.CharacterName}님 환영합니다!</h2>
      <p>이 토큰을 API 요청 시 Authorization 헤더에 사용하세요:</p>
      <code>Bearer ${token}</code>
    `);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send('로그인 실패');
    }
}
