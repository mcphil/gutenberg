CREATE TABLE `book_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gutenbergId` int NOT NULL,
	`shortSummary` text,
	`longSummary` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `book_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `book_summaries_gutenbergId_unique` UNIQUE(`gutenbergId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());