/*
  Warnings:

  - You are about to drop the column `s3_url` on the `file` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `file` DROP COLUMN `s3_url`;
