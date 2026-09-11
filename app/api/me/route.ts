import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { listWatches } from "@/lib/server/data";
import { getMember, jsonError } from "@/lib/server/security";

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const db = getRawDb();
    const owner = await db.prepare("SELECT id FROM members WHERE role = 'owner' AND revoked_at IS NULL LIMIT 1").first();
    const member = await getMember(request);
    if (!member) return Response.json({ configured: Boolean(owner), member: null });
    const [push, telegram, watches] = await Promise.all([
      db.prepare("SELECT id FROM push_subscriptions WHERE member_id = ? AND disabled_at IS NULL LIMIT 1").bind(member.id).first(),
      db.prepare("SELECT member_id FROM telegram_links WHERE member_id = ? AND disabled_at IS NULL LIMIT 1").bind(member.id).first(),
      listWatches(member.id),
    ]);
    return Response.json({ configured: true, member, channels: { push: Boolean(push), telegram: Boolean(telegram) }, watches });
  } catch (error) { return jsonError(error); }
}
