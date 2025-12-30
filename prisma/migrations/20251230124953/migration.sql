-- DropForeignKey
ALTER TABLE `board_history` DROP FOREIGN KEY `board_history_board_id_fkey`;

-- AddForeignKey
ALTER TABLE `board_history` ADD CONSTRAINT `board_history_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
