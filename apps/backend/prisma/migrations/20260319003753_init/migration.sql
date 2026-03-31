-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `otp_code` VARCHAR(10) NULL,
    `otp_expires_at` DATETIME(3) NULL,
    `refresh_token` TEXT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balances` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `balances_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `symbols` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `mt_symbol` VARCHAR(191) NOT NULL,
    `lot_size` DECIMAL(10, 4) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `price` DECIMAL(18, 2) NOT NULL,
    `commission` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `is_tradable` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trades` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `symbol_id` VARCHAR(191) NOT NULL,
    `type` ENUM('BUY', 'SELL') NOT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'FAILED') NOT NULL DEFAULT 'OPEN',
    `lot_size` DECIMAL(10, 4) NOT NULL,
    `open_price` DECIMAL(18, 6) NOT NULL,
    `close_price` DECIMAL(18, 6) NULL,
    `commission` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `profit_loss` DECIMAL(18, 2) NULL,
    `mt_order_id` VARCHAR(191) NULL,
    `mt_account_id` VARCHAR(191) NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trades_user_id_idx`(`user_id`),
    INDEX `trades_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('DEPOSIT', 'WITHDRAWAL', 'TRADE_OPEN', 'TRADE_CLOSE', 'COMMISSION') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `trade_id` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `transactions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mt_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(255) NOT NULL,
    `broker_server` VARCHAR(255) NULL,
    `login` VARCHAR(100) NULL,
    `platform` VARCHAR(10) NOT NULL DEFAULT 'mt5',
    `is_connected` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mt_accounts_account_id_key`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,

    UNIQUE INDEX `app_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `balances` ADD CONSTRAINT `balances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_symbol_id_fkey` FOREIGN KEY (`symbol_id`) REFERENCES `symbols`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
