/*
  Warnings:

  - You are about to drop the column `last_editor_id` on the `board` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `board` DROP COLUMN `last_editor_id`,
    ADD COLUMN `last_editor_name` VARCHAR(191) NULL;
