/*쿠키 설정
    redis에서는 서버의 만료시간 , 클라이언트로 넘어간 쿠키의 만료시간을 다르게 설정 할 수 있음.
    두 만료시간이 다를 경우 문제가 생길 수 있기에 일관성 보장을 위해 config로 분리
*/
export function getSessionConfig() {
    const isDev = process.env.isDev === "true";
    return {
        TTL: 600,
        COOKIE_OPTIONS: {
            httpOnly: true,
            secure: !isDev,
            sameSite: "lax",
            path: "/",
            ...(isDev ? {} : { domain: ".catalyst-for-you.com" }),
            maxAge: 86_400_000, // 쿠키 만료일 : 1일 (JWT 유효기간과 동일하게 가져가야함)
        },
    };
}

export function getServerDomain() {
    return process.env.isDev === "true"
        ? "http://127.0.0.1:4000/"
        : "https://community.catalyst-for-you.com";
}

//글쓰기가 가능한 권한 리스트
export const ALLOWED_WRITE_ROLE = [
    "새끼 고양이",
    "고양이",
    "FC",
    "CEO",
    "리쿠르터",
    // ...필요한 타이틀 추가
];

//게시글,댓글,수정,밴,정지 가능한 권한 리스트
export const ALLOWED_EDIT_ROLE = ["FC", "CEO", "COO"];

//허용할 코퍼레이션 리스트
export const ALLOWED_CORP_ID = [
    98641311, //캣포유
    98616206, //대구
    98494391, //물고기
];

export const defaultEnv = {
    isDev: "true", //개발환경 여부
    changeArtifactMode: "false", //아티팩트 선택 변경 모드
};

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; //S3에 단일로 업로드 가능한 용량 최대 용량 (1GB)

export const s3UploadTimeout = 3600; //S3에 파일을 올릴 수 있는 Presigned URL 유효시간 (1시간)

//BlockNote의 RAW JSON -> HTML로 변환하는 과정에서 커스텀으로 구현한 이모지의 공통 정의
//해당 값은 클라이언트 레포지토리와 항상 같아야함
//v1.0 edit by bonsai 2025/12/23
export const emojiSpecDefinition = {
    type: "emoji",
    propSchema: {
        src: { default: "" },
        alt: { default: "" },
        width: { default: undefined, type: "number" },
        height: { default: undefined, type: "number" },
        size: { default: undefined, type: "number" },
        scale: { default: 1 },
    },
    content: "none",
    draggable: false,
};

export const DAYS_BEFORE_DELETION = 7; //게시글 삭제 처리후 몇일후 지울건지

export const CACHE_TTL_LATEST = 60; // 최신글을 캐싱하는데 필요한 최소 TTL
export const CACHE_TTL_TOP = 180; //이번달 최고 인기글 캐싱하는데 필요한 최소 TTL
