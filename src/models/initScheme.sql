USE default;

CREATE TABLE users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '내부 고유 ID',
    character_id    BIGINT      NOT NULL UNIQUE COMMENT 'EVE 캐릭터 ID',
    nickname        VARCHAR(64) NOT NULL UNIQUE COMMENT '캐릭터 닉네임',
    refresh_token   VARCHAR(512) NOT NULL UNIQUE COMMENT 'Refresh Token',
    access_token    VARCHAR(512) NOT NULL UNIQUE COMMENT 'Access Token',
    access_expires_at DATETIME  COMMENT 'Access Token 만료 시각',
    last_login_at   DATETIME    COMMENT '최종 로그인 시각',
    last_login_ip   VARCHAR(45) COMMENT '최종 로그인 IP (IPv6 대응)',
    scopes          VARCHAR(255) COMMENT '발급받은 스코프',
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 로그인 시각',
    updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '토큰 갱신 시각',
    Role            VARCHAR(64) COMMENT '이브온라인 직책'
);
