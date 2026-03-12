CREATE TABLE `books` (
	`gutenbergId` int NOT NULL,
	`type` varchar(32) NOT NULL DEFAULT 'Text',
	`issued` varchar(16),
	`title` text NOT NULL,
	`language` varchar(64) NOT NULL,
	`authors` text,
	`subjects` text,
	`locc` varchar(64),
	`bookshelves` text,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `books_gutenbergId` PRIMARY KEY(`gutenbergId`)
);
--> statement-breakpoint
CREATE INDEX `title_idx` ON `books` (`title`);