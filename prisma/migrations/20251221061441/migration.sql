/*
  Warnings:

  - Added the required column `updated_dt` to the `board` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `board` ADD COLUMN `is_deleted` TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN `last_editor_id` BIGINT NULL,
    ADD COLUMN `updated_dt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `board_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `board_id` BIGINT NOT NULL,
    `prev_title` VARCHAR(200) NOT NULL,
    `prev_content` JSON NOT NULL,
    `editor_id` BIGINT NOT NULL,
    `edit_dt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `board_history_board_id_idx`(`board_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `board_is_deleted_idx` ON `board`(`is_deleted`);

-- AddForeignKey
ALTER TABLE `board_history` ADD CONSTRAINT `board_history_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
