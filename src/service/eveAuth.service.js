//ES6 방식은 require이 아니라 import 방식이에요
import { Buffer } from 'buffer';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import { v4 as uuidv4 } from 'uuid'; //랜덤 숫자 만들어주는 기능
dotenv.config(); // 환경 변수 불러오기 (.env 파일에서)

// .env 파일에 설정된 값을 사용합니다
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, ESI_SCOPE } = process.env;

/**
 * 사용자를 EVE Online 로그인 페이지로 보내기 위한 URL을 생성합니다.
 * 사용자가 이 URL로 들어가면 EVE 계정으로 로그인하고, 인증 코드(code)를 받게 됩니다.
 */
export function getAuthUrl() {
    const state = uuidv4(); //이 UUID는 사용자가 이브에 갔다가 왔을때 동일인물임을 증명할때 사용합니다.

    const params = new URLSearchParams({
        response_type: 'code', // OAuth2 표준: code를 요청
        redirect_uri: REDIRECT_URI, // 로그인 성공 후 이동할 URL
        client_id: CLIENT_ID, // EVE 개발자 포털에서 받은 클라이언트 ID
        scope: ESI_SCOPE, // 접근 권한 범위 (이번엔 공개 정보만)
        state: state,
    });

    return `https://login.eveonline.com/v2/oauth/authorize?${params.toString()}`;
}

/**
 * 로그인 후 받은 인증 코드(code)를 가지고,
 * access_token을 요청하고, 최종적으로 캐릭터 정보를 가져오는 함수입니다.
 */
export async function processCallback(code) {
    if (!code) {
        throw new Error('로그인 코드(code)가 없습니다!');
    }

    // 1️⃣ 클라이언트 ID와 시크릿을 base64로 인코딩 (OAuth 규약)
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    // 2️⃣ code를 이용해서 access_token 요청
    const tokenResponse = await fetch('https://login.eveonline.com/v2/oauth/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicAuth}`, // 앱 인증 정보
            'Content-Type': 'application/x-www-form-urlencoded', // POST 형식
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code', // OAuth 방식
            code: code, // 로그인 후 받은 코드
        }),
    });

    // access_token 요청 실패 시 에러 메시지 확인
    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`토큰 요청 실패: ${errorText}`);
    }

    // access_token을 JSON으로 파싱
    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;

    // 3️⃣ access_token을 사용해서 캐릭터 정보 요청
    const verifyResponse = await fetch('https://login.eveonline.com/oauth/verify', {
        headers: {
            Authorization: `Bearer ${access_token}`, // 사용자 인증 토큰
        },
    });

    // 사용자 정보 요청 실패 시 에러 확인
    if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        throw new Error(`사용자 정보 요청 실패: ${errorText}`);
    }

    // 사용자 정보(JSON) 반환
    const characterData = await verifyResponse.json();
    return characterData;
}
