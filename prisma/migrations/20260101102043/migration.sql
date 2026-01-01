-- CreateTable
CREATE TABLE `boardLike` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `board_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `boardLike_board_id_idx`(`board_id`),
    INDEX `boardLike_user_id_idx`(`user_id`),
    UNIQUE INDEX `boardLike_user_id_board_id_key`(`user_id`, `board_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `boardLike` ADD CONSTRAINT `boardLike_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`character_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boardLike` ADD CONSTRAINT `boardLike_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
