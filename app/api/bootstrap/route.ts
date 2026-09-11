import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { bindings } from "@/lib/server/env";
import { createSession, hashToken, jsonError, sessionCookie } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const input = await request.json() as { token?: string; displayName?: string };
    const name = input.displayName?.trim();
    const expected = bindings().SETUP_TOKEN || (new URL(request.url).hostname === "localhost" ? "trainalert-local" : "");
    if (!name || name.length > 60) return Response.json({ error: "Enter a valid display name." }, { status: 400 });
    if (!expected || await hashToken(input.token || "") !== await hashToken(expected)) return Response.json({ error: "That setup code is not valid." }, { status: 403 });
    const db = getRawDb();
    if (await db.prepare("SELECT id FROM members WHERE role = 'owner' LIMIT 1").first()) return Response.json({ error: "Owner access has already been set up." }, { status: 409 });
    const memberId = crypto.randomUUID();
    await db.prepare("INSERT INTO members (id, display_name, role) VALUES (?, ?, 'owner')").bind(memberId, name).run();
    const session = await createSession(memberId);
    return Response.json({ ok: true }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, request) } });
  } catch (error) { return jsonError(error); }
}
