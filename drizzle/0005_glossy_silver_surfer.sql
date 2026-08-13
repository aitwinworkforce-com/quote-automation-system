CREATE TABLE `auditFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` varchar(128) NOT NULL,
	`quoteId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`rating` enum('useful','not_useful') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditFeedback_id` PRIMARY KEY(`id`)
);
