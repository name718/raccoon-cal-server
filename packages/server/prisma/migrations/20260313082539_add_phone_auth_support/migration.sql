/*
  Warnings:

  - You are about to drop the column `is_verified` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `users` DROP COLUMN `is_verified`,
    ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `phone` VARCHAR(20) NULL,
    ADD COLUMN `phone_verified` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `email` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);

-- CreateIndex
CREATE INDEX `users_phone_idx` ON `users`(`phone`);
