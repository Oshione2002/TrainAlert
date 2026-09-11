import { getRawDb } from "@/db";
import { jsonError, requireMember } from "@/lib/server/security";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireMember(request);
    if (owner.role !== "owner") return Response.json({ error: "Owner access required." }, { status: 403 });
    const { id } = await context.params;
    if (id === owner.id) return Response.json({ error: "The owner cannot revoke their own device here." }, { status: 400 });
    const db = getRawDb();
    await db.batch([
      db.prepare("UPDATE members SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'member'").bind(id),
      db.prepare("UPDATE watches SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE member_id = ?").bind(id),
      db.prepare("DELETE FROM sessions WHERE member_id = ?").bind(id),
      db.prepare("UPDATE push_subscriptions SET disabled_at = CURRENT_TIMESTAMP WHERE member_id = ?").bind(id),
      db.prepare("UPDATE telegram_links SET disabled_at = CURRENT_TIMESTAMP WHERE member_id = ?").bind(id),
    ]);
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
