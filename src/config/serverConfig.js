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
            maxAge: 86_300_000, // 쿠키 만료일 : 1일 (JWT 유효기간과 동일하게 가져가야함)
        },
    };
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

export function getFileServerDomain() {
    const isDev = process.env.isDev === "true";
    return isDev
        ? "https://cat4u-dev-bucket.s3.ap-northeast-2.amazonaws.com"
        : "https:TODO 리스트 해야함 안하면 작동안함";
} // TODO (prod):
// - dev는 S3 객체를 직접 공개(GET)해서 `${S3_BASE_URL}/incoming/...` 로 바로 서빙 중.
// - prod는 S3를 private로 유지하고, CloudFront(OAC)로만 접근 가능하게 구성해야 함.
// - 파일 URL은 `${CDN_BASE_URL}/incoming/<key>` 형태(예: https://dxxxx.cloudfront.net/incoming/... 또는 files 전용 도메인).
// - 권한이 필요한 경우에는 백엔드가 CloudFront Signed URL 또는 Signed Cookie(짧은 TTL)를 발급해서 클라이언트에 전달.
//   (즉, 파일 바이트는 S3/CloudFront -> 클라이언트로 직접 전달되고, 서버는 “접근 토큰”만 발급)

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
