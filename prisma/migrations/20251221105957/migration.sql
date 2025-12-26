/*
  Warnings:

  - You are about to drop the column `character_id` on the `board` table. All the data in the column will be lost.
  - Added the required column `nickname` to the `board` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `board` DROP FOREIGN KEY `board_character_id_fkey`;

-- DropIndex
DROP INDEX `board_character_id_fkey` ON `board`;

-- AlterTable
ALTER TABLE `board` DROP COLUMN `character_id`,
    ADD COLUMN `nickname` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `board_id_type_idx` ON `board`(`id`, `type`);

-- AddForeignKey
ALTER TABLE `board` ADD CONSTRAINT `board_nickname_fkey` FOREIGN KEY (`nickname`) REFERENCES `users`(`nickname`) ON DELETE CASCADE ON UPDATE CASCADE;
