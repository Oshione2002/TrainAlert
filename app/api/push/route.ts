import { getRawDb } from "@/db";
import { jsonError, requireMember } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    const input = await request.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!input.endpoint || !input.keys?.p256dh || !input.keys.auth) return Response.json({ error: "The push subscription was incomplete." }, { status: 400 });
    const db = getRawDb();
    await db.batch([
      db.prepare("DELETE FROM push_subscriptions WHERE member_id = ? OR endpoint = ?").bind(member.id, input.endpoint),
      db.prepare("INSERT INTO push_subscriptions (id, member_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), member.id, input.endpoint, input.keys.p256dh, input.keys.auth),
    ]);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
