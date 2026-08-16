CREATE TABLE `productImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`supplierName` varchar(128) NOT NULL,
	`productModel` varchar(255) NOT NULL,
	`productName` varchar(255),
	`imageUrl` text NOT NULL,
	`imageKey` varchar(512),
	`sourceType` varchar(32) NOT NULL DEFAULT 'manual',
	`sourceUrl` text,
	`tags` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `productImages_id` PRIMARY KEY(`id`)
);
