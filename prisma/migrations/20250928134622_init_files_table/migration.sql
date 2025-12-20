-- CreateTable
CREATE TABLE `file` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `file_md5` CHAR(32) NOT NULL,
    `original_name` VARCHAR(255) NULL,
    `extension` VARCHAR(10) NOT NULL,
    `size` BIGINT NOT NULL,
    `s3_key` VARCHAR(512) NOT NULL,
    `s3_url` TEXT NOT NULL,
    `is_optimized` BOOLEAN NOT NULL DEFAULT false,
    `ref_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_file_md5_key`(`file_md5`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
