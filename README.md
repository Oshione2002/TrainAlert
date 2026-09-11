# TrainAlert NG

TrainAlert NG watches the Nigerian Railway Corporation booking site and alerts a small private group when matching seats appear. It is an installable web app with web-push and Telegram delivery.

It never books, reserves, or pays for a seat. Selecting **Book now** permanently ends the alert and opens the official NRC booking site. Selecting **End alert** permanently ends it without opening NRC. Dismissing a notification keeps the two-minute reminders active while seats remain available.

## Features

- Single-use friend invites with device sessions; no passwords
- Up to 10 members, 3 active alerts per member, and 12 train/class targets per alert
- Date, departure, class, and minimum-seat filters
- Web-push notifications with `Book now` and `End alert` actions
- Telegram notifications with matching inline actions
- Owner member overview and revocation without exposing journey details
- Two-minute availability checks with outage backoff and per-episode delivery tracking

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. On localhost, the initial owner setup code defaults to `trainalert-local` if `SETUP_TOKEN` is not configured.

Useful checks:

```bash
npm run lint
npm test
npm run db:generate
```

## Configuration

Copy `.env.example` to `.env.local` and fill in the values:

- `SETUP_TOKEN`: one-time production owner activation code
- `INTERNAL_POLL_SECRET`: shared secret between the scheduler and `/api/internal/poll`
- `ACTION_SECRET`: signs one-click Telegram booking links
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`: BotFather and webhook settings
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: browser-push credentials
- `APP_URL`: the deployed HTTPS origin

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys --json
```

## Database and scheduling

The application uses Cloudflare D1. The generated schema migration is in `drizzle/0000_omniscient_maggott.sql`; local preview also bootstraps the same schema automatically.

The companion worker in `scheduler/worker.ts` calls the internal polling route every two minutes. Before deploying it, set `APP_URL` in `scheduler/wrangler.jsonc`, then add its secret and deploy:

```bash
npx wrangler secret put INTERNAL_POLL_SECRET --config scheduler/wrangler.jsonc
npm run scheduler:deploy
```

Register the Telegram webhook after deployment:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## Safety and privacy

The checker uses NRC's public search endpoints and sends users to [the official NRC booking site](https://nrc.gsds.ng/) to complete a purchase. It stores only member display names, invite/session hashes, alert criteria, notification endpoints, and delivery state. It does not store NRC passwords or payment details.
