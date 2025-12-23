-- AlterTable
ALTER TABLE `board` ADD COLUMN `content_html` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `board_history` ADD COLUMN `prev_content_html` LONGTEXT NULL;
