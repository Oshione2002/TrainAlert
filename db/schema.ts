import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  revokedAt: text("revoked_at"),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  label: text("label").notNull(),
  createdBy: text("created_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull(),
  redeemedAt: text("redeemed_at"),
  redeemedBy: text("redeemed_by").references(() => members.id),
}, (table) => [uniqueIndex("idx_invites_token_hash").on(table.tokenHash)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  uniqueIndex("idx_sessions_token_hash").on(table.tokenHash),
  index("idx_sessions_member_id").on(table.memberId),
]);

export const watches = sqliteTable("watches", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  routeId: text("route_id").notNull(),
  originId: text("origin_id").notNull(),
  originName: text("origin_name").notNull(),
  destinationId: text("destination_id").notNull(),
  destinationName: text("destination_name").notNull(),
  travelDate: text("travel_date").notNull(),
  minimumSeats: integer("minimum_seats").notNull().default(1),
  status: text("status", { enum: ["active", "paused", "completed", "expired"] }).notNull().default("active"),
  lastCheckedAt: text("last_checked_at"),
  lastError: text("last_error"),
  pollFailures: integer("poll_failures").notNull().default(0),
  nextCheckAt: text("next_check_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_watches_member_status").on(table.memberId, table.status),
  index("idx_watches_poll_group").on(table.status, table.nextCheckAt, table.travelDate, table.originId, table.destinationId),
]);

export const watchTargets = sqliteTable("watch_targets", {
  id: text("id").primaryKey(),
  watchId: text("watch_id").notNull().references(() => watches.id, { onDelete: "cascade" }),
  tripId: text("trip_id").notNull(),
  trainName: text("train_name").notNull(),
  departureTime: text("departure_time").notNull(),
  arrivalTime: text("arrival_time").notNull(),
  coachTypeId: text("coach_type_id").notNull(),
  coachTypeName: text("coach_type_name").notNull(),
  fare: integer("fare").notNull().default(0),
  lastSeats: integer("last_seats").notNull().default(0),
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(false),
  episodeId: text("episode_id"),
  lastNotifiedAt: text("last_notified_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_targets_watch_trip_coach").on(table.watchId, table.tripId, table.coachTypeId),
  index("idx_targets_watch_id").on(table.watchId),
]);

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  failureCount: integer("failure_count").notNull().default(0),
  disabledAt: text("disabled_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_push_member").on(table.memberId),
  uniqueIndex("idx_push_endpoint").on(table.endpoint),
]);

export const telegramLinks = sqliteTable("telegram_links", {
  memberId: text("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  linkedAt: text("linked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  disabledAt: text("disabled_at"),
}, (table) => [uniqueIndex("idx_telegram_chat_id").on(table.chatId)]);

export const telegramTokens = sqliteTable("telegram_tokens", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  redeemedAt: text("redeemed_at"),
}, (table) => [uniqueIndex("idx_telegram_token_hash").on(table.tokenHash)]);

export const deliveries = sqliteTable("deliveries", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  targetId: text("target_id").notNull(),
  channel: text("channel", { enum: ["push", "telegram"] }).notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  seatCount: integer("seat_count").notNull(),
  error: text("error"),
  sentAt: text("sent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_deliveries_member_sent").on(table.memberId, table.sentAt)]);
