import { getRawDb } from "@/db";
import { bindings } from "@/lib/server/env";
import { hashToken, jsonError, randomToken, requireMember } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    const username = bindings().TELEGRAM_BOT_USERNAME;
    if (!username || !bindings().TELEGRAM_BOT_TOKEN) return Response.json({ error: "Telegram is not configured yet." }, { status: 503 });
    const token = randomToken(24);
    await getRawDb().prepare("INSERT INTO telegram_tokens (id, token_hash, member_id, expires_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), await hashToken(token), member.id, new Date(Date.now() + 15 * 60000).toISOString()).run();
    return Response.json({ url: `https://t.me/${username}?start=${token}` });
  } catch (error) { return jsonError(error); }
}
