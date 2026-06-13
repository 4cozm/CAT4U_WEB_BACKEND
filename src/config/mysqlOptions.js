export const getMysqlOptions = () => ({
    host: process.env.MYSQL_IP,
    port: 3306,
    user: "root",
    password: process.env.MYSQL_PASSWORD,
    database: "default",
    connectionLimit: 10,
    // MySQL 8 caching_sha2_password: 비TLS 연결에서 첫 인증 시 서버 RSA 공개키 교환이 필요.
    // MySQL 재시작으로 인증 캐시가 비워지면 매 연결이 키 교환을 다시 타는데, 이 옵션이 없으면
    // "RSA public key is not available" → 인증 실패 → pool timeout 으로 이어진다. (localhost 한정 안전)
    allowPublicKeyRetrieval: true,
});
