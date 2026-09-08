ALTER TABLE `participants` ADD `origin` text DEFAULT 'participant' NOT NULL;--> statement-breakpoint
ALTER TABLE `solutions` ADD `origin` text DEFAULT 'participant' NOT NULL;