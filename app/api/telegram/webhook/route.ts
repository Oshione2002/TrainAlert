import { getRawDb } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";
import { completeWatchForTarget } from "@/lib/server/data";
import { bindings } from "@/lib/server/env";
import { hashToken, jsonError } from "@/lib/server/security";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat: { id: string | number };
    from?: { username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat?: { id: string | number }; message_id?: number };
  };
};

async function telegram(method: string, body: Record<string, unknown>) {
  const token = bindings().TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const expected = bindings().TELEGRAM_WEBHOOK_SECRET;
    if (expected && request.headers.get("x-telegram-bot-api-secret-token") !== expected) return new Response("Forbidden", { status: 403 });
    const update = await request.json() as TelegramUpdate;
    if (update.message?.text?.startsWith("/start ")) {
      const token = update.message.text.slice(7).trim();
      const link = await getRawDb().prepare("SELECT id, member_id AS memberId FROM telegram_tokens WHERE token_hash = ? AND redeemed_at IS NULL AND expires_at > CURRENT_TIMESTAMP")
        .bind(await hashToken(token)).first<{ id: string; memberId: string }>();
      if (!link) { await telegram("sendMessage", { chat_id: update.message.chat.id, text: "That TrainAlert link has expired. Create a new one in the app." }); return Response.json({ ok: true }); }
      const db = getRawDb();
      await db.batch([
        db.prepare("DELETE FROM telegram_links WHERE member_id = ? OR chat_id = ?").bind(link.memberId, String(update.message.chat.id)),
        db.prepare("INSERT INTO telegram_links (member_id, chat_id, username) VALUES (?, ?, ?)").bind(link.memberId, String(update.message.chat.id), update.message.from?.username || null),
        db.prepare("UPDATE telegram_tokens SET redeemed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(link.id),
      ]);
      await telegram("sendMessage", { chat_id: update.message.chat.id, text: "✅ Telegram is connected to TrainAlert. Your seat alerts will arrive here." });
    }
    if (update.callback_query?.data?.startsWith("end:")) {
      const targetId = update.callback_query.data.slice(4);
      const link = await getRawDb().prepare("SELECT member_id AS memberId FROM telegram_links WHERE chat_id = ? AND disabled_at IS NULL").bind(String(update.callback_query.message?.chat?.id)).first<{ memberId: string }>();
      const ended = link ? await completeWatchForTarget(targetId, link.memberId) : false;
      await telegram("answerCallbackQuery", { callback_query_id: update.callback_query.id, text: ended ? "Alert ended" : "This alert is no longer active", show_alert: false });
      if (ended && update.callback_query.message?.chat && update.callback_query.message.message_id != null) {
        await telegram("editMessageReplyMarkup", { chat_id: update.callback_query.message.chat.id, message_id: update.callback_query.message.message_id, reply_markup: { inline_keyboard: [] } });
      }
    }
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
