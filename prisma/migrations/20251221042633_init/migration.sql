-- CreateTable
CREATE TABLE `board` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` ENUM('GUIDE', 'DOCTRINE', 'FITTING', 'MARKET') NOT NULL,
    `character_id` BIGINT NOT NULL,
    `board_title` VARCHAR(200) NOT NULL,
    `board_content` JSON NOT NULL,
    `create_dt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recommend_cnt` INTEGER NOT NULL DEFAULT 0,

    INDEX `board_type_create_dt_idx`(`type`, `create_dt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `board` ADD CONSTRAINT `board_character_id_fkey` FOREIGN KEY (`character_id`) REFERENCES `users`(`character_id`) ON DELETE CASCADE ON UPDATE CASCADE;
