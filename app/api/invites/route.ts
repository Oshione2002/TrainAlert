import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { hashToken, jsonError, randomToken, requireMember } from "@/lib/server/security";

export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    if (member.role !== "owner") return Response.json({ error: "Owner access required." }, { status: 403 });
    const result = await getRawDb().prepare(`
      SELECT m.id, m.display_name AS displayName, m.role, m.revoked_at AS revokedAt,
        (SELECT COUNT(*) FROM watches w WHERE w.member_id = m.id AND w.status = 'active') AS activeAlerts,
        EXISTS(SELECT 1 FROM push_subscriptions p WHERE p.member_id = m.id AND p.disabled_at IS NULL) AS push,
        EXISTS(SELECT 1 FROM telegram_links t WHERE t.member_id = m.id AND t.disabled_at IS NULL) AS telegram
      FROM members m ORDER BY m.created_at
    `).all();
    return Response.json({ members: result.results || [] });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    if (member.role !== "owner") return Response.json({ error: "Owner access required." }, { status: 403 });
    await ensureDatabase();
    const { label } = await request.json() as { label?: string };
    if (!label?.trim() || label.trim().length > 60) return Response.json({ error: "Enter a valid name for this invite." }, { status: 400 });
    const count = await getRawDb().prepare("SELECT COUNT(*) AS count FROM members WHERE revoked_at IS NULL").first<{ count: number }>();
    if (Number(count?.count || 0) >= 10) return Response.json({ error: "The ten-person limit has been reached." }, { status: 409 });
    const token = randomToken();
    const expires = new Date(Date.now() + 72 * 3600000).toISOString();
    await getRawDb().prepare("INSERT INTO invites (id, token_hash, label, created_by, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), await hashToken(token), label.trim(), member.id, expires).run();
    return Response.json({ inviteUrl: `${new URL(request.url).origin}/#invite=${token}`, expiresAt: expires }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
