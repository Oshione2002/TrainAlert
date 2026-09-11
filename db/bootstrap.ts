import { getRawDb } from "./index";

let ready: Promise<void> | undefined;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES members(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, redeemed_at TEXT, redeemed_by TEXT REFERENCES members(id))`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS watches (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, route_id TEXT NOT NULL, origin_id TEXT NOT NULL, origin_name TEXT NOT NULL, destination_id TEXT NOT NULL, destination_name TEXT NOT NULL, travel_date TEXT NOT NULL, minimum_seats INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'active', last_checked_at TEXT, last_error TEXT, poll_failures INTEGER NOT NULL DEFAULT 0, next_check_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS watch_targets (id TEXT PRIMARY KEY, watch_id TEXT NOT NULL REFERENCES watches(id) ON DELETE CASCADE, trip_id TEXT NOT NULL, train_name TEXT NOT NULL, departure_time TEXT NOT NULL, arrival_time TEXT NOT NULL, coach_type_id TEXT NOT NULL, coach_type_name TEXT NOT NULL, fare INTEGER NOT NULL DEFAULT 0, last_seats INTEGER NOT NULL DEFAULT 0, is_available INTEGER NOT NULL DEFAULT 0, episode_id TEXT, last_notified_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, failure_count INTEGER NOT NULL DEFAULT 0, disabled_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS telegram_links (member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE, chat_id TEXT NOT NULL UNIQUE, username TEXT, linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, disabled_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS telegram_tokens (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, redeemed_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, member_id TEXT NOT NULL, target_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL, seat_count INTEGER NOT NULL, error TEXT, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_token_hash ON invites(token_hash)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON sessions(member_id)`,
  `CREATE INDEX IF NOT EXISTS idx_watches_member_status ON watches(member_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_watches_poll_group ON watches(status, next_check_at, travel_date, origin_id, destination_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_targets_watch_trip_coach ON watch_targets(watch_id, trip_id, coach_type_id)`,
  `CREATE INDEX IF NOT EXISTS idx_targets_watch_id ON watch_targets(watch_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_push_member ON push_subscriptions(member_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_chat_id ON telegram_links(chat_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deliveries_member_sent ON deliveries(member_id, sent_at)`,
];

export async function ensureDatabase() {
  ready ??= (async () => {
    const db = getRawDb();
    for (let start = 0; start < schemaStatements.length; start += 20) {
      await db.batch(schemaStatements.slice(start, start + 20).map((statement) => db.prepare(statement)));
    }
  })();
  return ready;
}
