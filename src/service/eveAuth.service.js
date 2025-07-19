// ES6 import 방식으로 필요한 라이브러리 불러오기
import axios from 'axios';
import { Buffer } from 'buffer';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config(); // .env 파일에서 환경변수 불러오기

// .env 파일에 설정된 값들
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, ESI_SCOPE } = process.env;

/**
 * 사용자를 EVE Online 로그인 페이지로 보내기 위한 URL을 생성합니다.
 * 사용자가 이 URL로 들어가면 EVE 계정으로 로그인하고, 인증 코드(code)를 받게 됩니다.
 */
export function getAuthUrl() {
    const state = uuidv4(); // 랜덤 문자열 생성 (요청한 사용자를 추적하기 위한 보안 토큰)

    const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        scope: ESI_SCOPE,
        state: state,
    });

    return `https://login.eveonline.com/v2/oauth/authorize?${params.toString()}`;
}

/**
 * 로그인 후 받은 인증 코드(code)를 사용해:
 * - access_token을 요청하고
 * - access_token으로 캐릭터 정보를 조회합니다.
 */
export async function processCallback(code) {
    if (!code) {
        throw new Error('로그인 코드(code)가 없습니다!');
    }

    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    let tokenData;
    try {
        const tokenResponse = await axios.post(
            'https://login.eveonline.com/v2/oauth/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
            }),
            {
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        tokenData = tokenResponse.data;
    } catch (err) {
        const msg = err.response?.data || err.message;
        throw new Error(`토큰 요청 실패: ${JSON.stringify(msg)}`);
    }

    const { access_token, refresh_token } = tokenData;

    try {
        const verifyResponse = await axios.get('https://login.eveonline.com/oauth/verify', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const character = verifyResponse.data;

        //여기서 return으로 필수 데이터만 전달하고 refresh token은 UUID를 키로 해서 DB에 저장하는게 좋음
        return {
            ...character,
            access_token,
            refresh_token,
            expires_in: tokenData.expires_in,
        };
    } catch (err) {
        const msg = err.response?.data || err.message;
        throw new Error(`사용자 정보 요청 실패: ${JSON.stringify(msg)}`);
    }
}
