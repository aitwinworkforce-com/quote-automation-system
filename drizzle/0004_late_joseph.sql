ALTER TABLE `quotes` MODIFY COLUMN `status` enum('draft','extracted','costed','awaiting_sf_number','in_review','finalized') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `quotes` ADD `rateConfirmedBy` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `rateConfirmedByName` varchar(255);--> statement-breakpoint
ALTER TABLE `quotes` ADD `rateConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `quotes` ADD `submittedForReviewAt` timestamp;--> statement-breakpoint
ALTER TABLE `quotes` ADD `submittedForReviewBy` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `quotes` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `approvedByName` varchar(255);