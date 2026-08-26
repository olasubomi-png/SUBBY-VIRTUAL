CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` varchar(80),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mailMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inboxId` int NOT NULL,
	`fromAddress` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mailMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int,
	`serviceId` varchar(64) NOT NULL,
	`currency` enum('NGN','USD') NOT NULL,
	`amountMinor` bigint NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `priceRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `providerBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`currency` enum('NGN','USD') NOT NULL,
	`amountMinor` bigint NOT NULL,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `providerBalances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`type` enum('SMS','MAIL') NOT NULL,
	`mode` enum('MOCK','PRODUCTION') NOT NULL,
	`status` enum('ACTIVE','PAUSED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smsActivations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` int,
	`countryCode` varchar(3) NOT NULL,
	`serviceId` varchar(64) NOT NULL,
	`phoneNumber` varchar(32),
	`status` enum('WAITING','RECEIVED','CANCELLED','EXPIRED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsActivations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smsMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activationId` int NOT NULL,
	`body` text NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supportTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subject` varchar(180) NOT NULL,
	`status` enum('OPEN','PENDING','RESOLVED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supportTickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `temporaryInboxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` int,
	`address` varchar(320) NOT NULL,
	`status` enum('ACTIVE','EXPIRED','DELETED') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `temporaryInboxes_id` PRIMARY KEY(`id`),
	CONSTRAINT `temporaryInboxes_address_unique` UNIQUE(`address`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletId` int NOT NULL,
	`kind` enum('DEPOSIT','PURCHASE','REFUND','ADJUSTMENT') NOT NULL,
	`status` enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL,
	`amountMinor` bigint NOT NULL,
	`reference` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `walletLedgerEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`type` enum('CREDIT','DEBIT') NOT NULL,
	`amountMinor` bigint NOT NULL,
	`reason` varchar(120) NOT NULL,
	`reference` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `walletLedgerEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletLedgerEntries_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currency` enum('NGN','USD') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','support') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX `audit_action_created_idx` ON `auditLogs` (`action`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ledger_wallet_created_idx` ON `walletLedgerEntries` (`walletId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `wallet_user_currency_idx` ON `wallets` (`userId`,`currency`);