CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort` text NOT NULL,
	`kind` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_created` ON `events` (`created`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `participants_created` ON `participants` (`created`);--> statement-breakpoint
CREATE TABLE `reuse` (
	`id` text PRIMARY KEY NOT NULL,
	`solution_id` text NOT NULL,
	`actor` text NOT NULL,
	`cohort` text NOT NULL,
	`outcome` text NOT NULL,
	`details` text NOT NULL,
	`created` text NOT NULL,
	`idem` text NOT NULL,
	`request_hash` text NOT NULL,
	FOREIGN KEY (`solution_id`) REFERENCES `solutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reuse_actor_idem` ON `reuse` (`actor`,`idem`);--> statement-breakpoint
CREATE INDEX `reuse_solution_created` ON `reuse` (`solution_id`,`created`);--> statement-breakpoint
CREATE INDEX `reuse_created` ON `reuse` (`created`);--> statement-breakpoint
CREATE TABLE `solutions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`cohort` text NOT NULL,
	`title` text NOT NULL,
	`problem` text NOT NULL,
	`context` text NOT NULL,
	`solution` text NOT NULL,
	`verification` text NOT NULL,
	`verification_state` text NOT NULL,
	`limitations` text NOT NULL,
	`tags` text NOT NULL,
	`based_on` text,
	`created` text NOT NULL,
	`idem` text NOT NULL,
	`request_hash` text NOT NULL,
	`discovery` text NOT NULL,
	`directed` text NOT NULL,
	FOREIGN KEY (`actor`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `solutions_actor_idem` ON `solutions` (`actor`,`idem`);--> statement-breakpoint
CREATE INDEX `solutions_cohort_created` ON `solutions` (`cohort`,`created`);--> statement-breakpoint
CREATE INDEX `solutions_based_on` ON `solutions` (`based_on`);--> statement-breakpoint
CREATE INDEX `solutions_created` ON `solutions` (`created`);