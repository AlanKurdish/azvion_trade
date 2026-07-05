-- AlterTable
ALTER TABLE `trades` ADD COLUMN `open_debit` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- Backfill: trades that are still OPEN were created under the legacy model,
-- which debited `customer_price` from the user's balance at open time.
-- Record that so closing them still returns the escrowed amount.
-- New trades (opened after this migration) keep open_debit = 0.
UPDATE `trades` SET `open_debit` = `customer_price` WHERE `status` = 'OPEN';
