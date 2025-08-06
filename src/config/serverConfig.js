/*redis에서는 서버의 만료시간 , 클라이언트로 넘어간 쿠키의 만료시간을 다르게 설정 할 수 있음.
  두 만료시간이 다를 경우 문제가 생길 수 있기에 일관성 보장을 위해 config로 분리
*/

export const SESSION_CONFIG = {
    TTL: 600, // 초 단위 (10분)
    COOKIE_OPTIONS: {
        secure: process.env.isDev === 'true' ? false : true,
        httpOnly: true,
    },
};
