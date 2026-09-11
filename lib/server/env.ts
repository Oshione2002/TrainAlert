import { env } from "cloudflare:workers";

export type AppBindings = {
  DB: D1Database;
  SETUP_TOKEN?: string;
  INTERNAL_POLL_SECRET?: string;
  ACTION_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  APP_URL?: string;
};

export function bindings() {
  return env as unknown as AppBindings;
}
