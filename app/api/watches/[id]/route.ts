import { getRawDb } from "@/db";
import { jsonError, requireMember } from "@/lib/server/security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request);
    const { id } = await context.params;
    const { status } = await request.json() as { status?: string };
    if (!status || !["active", "paused", "completed"].includes(status)) return Response.json({ error: "Invalid watch status." }, { status: 400 });
    if (status === "active") {
      const count = await getRawDb().prepare("SELECT COUNT(*) AS count FROM watches WHERE member_id = ? AND status = 'active'").bind(member.id).first<{ count: number }>();
      if (Number(count?.count || 0) >= 3) return Response.json({ error: "Only three watches can be active at once." }, { status: 409 });
    }
    const result = await getRawDb().prepare("UPDATE watches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND member_id = ?").bind(status, id, member.id).run();
    return Number(result.meta.changes || 0) ? Response.json({ ok: true }) : Response.json({ error: "Watch not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}
