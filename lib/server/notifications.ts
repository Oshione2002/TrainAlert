import webpush from "web-push";
import { getRawDb } from "@/db";
import { bindings } from "./env";
import { signAction } from "./security";

type AlertTarget = {
  id: string; memberId: string; originName: string; destinationName: string; travelDate: string;
  trainName: string; departureTime: string; coachTypeName: string; fare: number;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function logDelivery(target: AlertTarget, channel: "push" | "telegram", status: "sent" | "failed", seats: number, error?: string) {
  await getRawDb().prepare("INSERT INTO deliveries (id, member_id, target_id, channel, status, seat_count, error) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), target.memberId, target.id, channel, status, seats, error?.slice(0, 300) || null).run();
}

export async function notifyTarget(target: AlertTarget, seats: number, origin: string) {
  const env = bindings();
  const db = getRawDb();
  const body = `${target.trainName} · ${target.departureTime}\n${target.coachTypeName} · ${seats} seat${seats === 1 ? "" : "s"} open`;
  let delivered = false;
  const push = await db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ? AND disabled_at IS NULL LIMIT 1").bind(target.memberId).first<{ endpoint: string; p256dh: string; auth: string }>();
  if (push && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:trainalert@example.com", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
      await webpush.sendNotification({ endpoint: push.endpoint, keys: { p256dh: push.p256dh, auth: push.auth } }, JSON.stringify({ title: `${seats} seat${seats === 1 ? "" : "s"} just opened`, body, targetId: target.id }), { TTL: 120, urgency: "high" });
      await logDelivery(target, "push", "sent", seats); delivered = true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Push failed";
      await logDelivery(target, "push", "failed", seats, message);
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : null;
      if (statusCode === 404 || statusCode === 410) await db.prepare("UPDATE push_subscriptions SET disabled_at = CURRENT_TIMESTAMP WHERE member_id = ?").bind(target.memberId).run();
    }
  }
  const telegram = await db.prepare("SELECT chat_id AS chatId FROM telegram_links WHERE member_id = ? AND disabled_at IS NULL LIMIT 1").bind(target.memberId).first<{ chatId: string }>();
  if (telegram && env.TELEGRAM_BOT_TOKEN) {
    try {
      const actionToken = await signAction(target.id, "book");
      const appOrigin = env.APP_URL || origin;
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram.chatId,
          parse_mode: "HTML",
          text: `🚆 <b>${seats} seat${seats === 1 ? "" : "s"} available</b>\n${escapeHtml(target.originName)} → ${escapeHtml(target.destinationName)}\n${escapeHtml(target.travelDate)} · ${escapeHtml(target.departureTime)}\n${escapeHtml(target.trainName)} · ${escapeHtml(target.coachTypeName)} · ₦${target.fare.toLocaleString("en-NG")}`,
          reply_markup: { inline_keyboard: [[
            { text: "Book now ↗", url: `${appOrigin}/api/alerts/go?token=${encodeURIComponent(actionToken)}` },
            { text: "End alert", callback_data: `end:${target.id}` },
          ]] },
        }),
      });
      if (!response.ok) throw new Error(`Telegram returned ${response.status}`);
      await logDelivery(target, "telegram", "sent", seats); delivered = true;
    } catch (error) { await logDelivery(target, "telegram", "failed", seats, error instanceof Error ? error.message : "Telegram failed"); }
  }
  return delivered;
}
