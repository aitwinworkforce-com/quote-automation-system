CREATE TABLE `quoteEmailLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`sentBy` int NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`ccEmail` varchar(320),
	`subject` varchar(500) NOT NULL,
	`message` text,
	`status` enum('sent','failed') NOT NULL,
	`errorDetail` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quoteEmailLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quotes` ADD `parentQuoteId` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `rootQuoteId` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `revisionLabel` varchar(8) DEFAULT 'A' NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` ADD `isLatestRevision` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` ADD `revisionNote` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `lastSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `quotes` ADD `lastSentTo` varchar(320);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `defaultMarginPct` decimal(6,3);