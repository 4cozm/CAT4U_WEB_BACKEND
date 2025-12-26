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

-- CreateTable
CREATE TABLE `file` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `file_md5` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NULL,
    `extension` VARCHAR(191) NOT NULL,
    `size` BIGINT NOT NULL,
    `s3_key` VARCHAR(191) NOT NULL,
    `s3_url` VARCHAR(191) NOT NULL,
    `status` ENUM('uploaded', 'optimized') NOT NULL DEFAULT 'uploaded',
    `need_optimize` BOOLEAN NOT NULL DEFAULT true,
    `ref_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_file_md5_key`(`file_md5`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploadSession` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `file_md5` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NULL,
    `extension` VARCHAR(191) NOT NULL,
    `size` BIGINT NOT NULL,
    `s3_key` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'completed', 'failed', 'expired') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `file_id` BIGINT NULL,

    INDEX `uploadSession_file_md5_status_created_at_idx`(`file_md5`, `status`, `created_at`),
    INDEX `uploadSession_file_id_idx`(`file_id`),
    INDEX `uploadSession_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `uploadSession` ADD CONSTRAINT `uploadSession_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`character_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uploadSession` ADD CONSTRAINT `uploadSession_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
