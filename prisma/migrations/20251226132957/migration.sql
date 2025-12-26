/*
  Warnings:

  - You are about to alter the column `nickname` on the `board` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(64)`.
  - You are about to drop the column `editor_id` on the `board_history` table. All the data in the column will be lost.
  - Added the required column `editor_nickname` to the `board_history` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `board` DROP FOREIGN KEY `board_nickname_fkey`;

-- DropIndex
DROP INDEX `board_nickname_fkey` ON `board`;

-- AlterTable
ALTER TABLE `board` MODIFY `nickname` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `board_history` DROP COLUMN `editor_id`,
    ADD COLUMN `editor_nickname` VARCHAR(64) NOT NULL;

-- AddForeignKey
ALTER TABLE `board` ADD CONSTRAINT `board_nickname_fkey` FOREIGN KEY (`nickname`) REFERENCES `users`(`nickname`) ON DELETE CASCADE ON UPDATE CASCADE;
