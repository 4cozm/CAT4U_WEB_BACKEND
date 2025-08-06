/*redis에서는 서버의 만료시간 , 클라이언트로 넘어간 쿠키의 만료시간을 다르게 설정 할 수 있음.
  두 만료시간이 다를 경우 문제가 생길 수 있기에 일관성 보장을 위해 config로 분리
*/
export function getSessionConfig() {
    return {
        TTL: 600,
        COOKIE_OPTIONS:
            process.env.isDev === 'true'
                ? { httpOnly: true, secure: false, sameSite: 'lax' }
                : { httpOnly: true, secure: true, sameSite: 'lax' },
    };
}

//글쓰기가 가능한 권한 리스트
export const ALLOWED_WRITE_ROLE = [
    '새끼 고양이',
    '고양이',
    'FC',
    'CEO',
    '리쿠르터',
    // ...필요한 타이틀 추가
];

//게시글,댓글,밴,정지 가능한 권한 리스트
export const ALLOWED_EDIT_ROLE = ['FC', 'CEO', 'COO'];

export const ALLOWED_CORP_ID = [
    98641311, //캣포유
    98616206, //대구
    98494391, //물고기
];
