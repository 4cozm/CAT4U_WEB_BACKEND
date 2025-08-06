-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `character_id` BIGINT NOT NULL,
    `nickname` VARCHAR(64) NOT NULL,
    `corp` INTEGER NOT NULL,
    `refresh_token` VARCHAR(64) NOT NULL,
    `access_expires_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `scopes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `Role` VARCHAR(64) NULL,

    UNIQUE INDEX `users_character_id_key`(`character_id`),
    UNIQUE INDEX `users_nickname_key`(`nickname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
