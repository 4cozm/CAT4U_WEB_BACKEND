/*
  Warnings:

  - You are about to drop the column `content_html` on the `board` table. All the data in the column will be lost.
  - You are about to drop the column `prev_content_html` on the `board_history` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `board` DROP COLUMN `content_html`;

-- AlterTable
ALTER TABLE `board_history` DROP COLUMN `prev_content_html`;
