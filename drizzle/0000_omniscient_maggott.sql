CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`target_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`seat_count` integer NOT NULL,
	`error` text,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deliveries_member_sent` ON `deliveries` (`member_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_at` text,
	`redeemed_by` text,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invites_token_hash` ON `invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`disabled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_member` ON `push_subscriptions` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_member_id` ON `sessions` (`member_id`);--> statement-breakpoint
CREATE TABLE `telegram_links` (
	`member_id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`username` text,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`disabled_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telegram_chat_id` ON `telegram_links` (`chat_id`);--> statement-breakpoint
CREATE TABLE `telegram_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telegram_token_hash` ON `telegram_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `watch_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`train_name` text NOT NULL,
	`departure_time` text NOT NULL,
	`arrival_time` text NOT NULL,
	`coach_type_id` text NOT NULL,
	`coach_type_name` text NOT NULL,
	`fare` integer DEFAULT 0 NOT NULL,
	`last_seats` integer DEFAULT 0 NOT NULL,
	`is_available` integer DEFAULT false NOT NULL,
	`episode_id` text,
	`last_notified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`watch_id`) REFERENCES `watches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_targets_watch_trip_coach` ON `watch_targets` (`watch_id`,`trip_id`,`coach_type_id`);--> statement-breakpoint
CREATE INDEX `idx_targets_watch_id` ON `watch_targets` (`watch_id`);--> statement-breakpoint
CREATE TABLE `watches` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`route_id` text NOT NULL,
	`origin_id` text NOT NULL,
	`origin_name` text NOT NULL,
	`destination_id` text NOT NULL,
	`destination_name` text NOT NULL,
	`travel_date` text NOT NULL,
	`minimum_seats` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_checked_at` text,
	`last_error` text,
	`poll_failures` integer DEFAULT 0 NOT NULL,
	`next_check_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_watches_member_status` ON `watches` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_watches_poll_group` ON `watches` (`status`,`next_check_at`,`travel_date`,`origin_id`,`destination_id`);