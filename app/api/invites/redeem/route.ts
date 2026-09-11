import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { createSession, hashToken, jsonError, sessionCookie } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const input = await request.json() as { token?: string; displayName?: string };
    const name = input.displayName?.trim();
    if (!name || name.length > 60) return Response.json({ error: "Enter a valid display name." }, { status: 400 });
    const db = getRawDb();
    const invite = await db.prepare("SELECT id FROM invites WHERE token_hash = ? AND redeemed_at IS NULL AND expires_at > CURRENT_TIMESTAMP")
      .bind(await hashToken(input.token || "")).first<{ id: string }>();
    if (!invite) return Response.json({ error: "This invite is invalid, expired, or already used." }, { status: 403 });
    const count = await db.prepare("SELECT COUNT(*) AS count FROM members WHERE revoked_at IS NULL").first<{ count: number }>();
    if (Number(count?.count || 0) >= 10) return Response.json({ error: "This alert circle is full." }, { status: 409 });
    const memberId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO members (id, display_name, role) VALUES (?, ?, 'member')").bind(memberId, name),
      db.prepare("UPDATE invites SET redeemed_at = CURRENT_TIMESTAMP, redeemed_by = ? WHERE id = ? AND redeemed_at IS NULL").bind(memberId, invite.id),
    ]);
    const session = await createSession(memberId);
    return Response.json({ ok: true }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, request) } });
  } catch (error) { return jsonError(error); }
}
