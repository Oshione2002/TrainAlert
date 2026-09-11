import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { bindings } from "./env";

export type MemberSession = { id: string; displayName: string; role: "owner" | "member" };

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function getMember(request: Request): Promise<MemberSession | null> {
  await ensureDatabase();
  const token = readCookie(request, "trainalert_session");
  if (!token) return null;
  const hash = await hashToken(token);
  const row = await getRawDb().prepare(`
    SELECT m.id, m.display_name AS displayName, m.role
    FROM sessions s JOIN members m ON m.id = s.member_id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP AND m.revoked_at IS NULL
  `).bind(hash).first<MemberSession>();
  return row || null;
}

export async function requireMember(request: Request) {
  const member = await getMember(request);
  if (!member) throw new Response(JSON.stringify({ error: "Invite access required" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return member;
}

export async function createSession(memberId: string) {
  const token = randomToken();
  const hash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  await getRawDb().prepare("INSERT INTO sessions (id, token_hash, member_id, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), hash, memberId, expiresAt).run();
  return { token, expiresAt };
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `trainalert_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${180 * 24 * 60 * 60}${secure}`;
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function actionKey() {
  const secret = bindings().ACTION_SECRET || bindings().INTERNAL_POLL_SECRET || "trainalert-local-action-secret";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signAction(targetId: string, action: "book") {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ targetId, action, expires: Date.now() + 7 * 86400000 })));
  const signature = await crypto.subtle.sign("HMAC", await actionKey(), new TextEncoder().encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyAction(token: string): Promise<{ targetId: string; action: "book" } | null> {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const valid = await crypto.subtle.verify("HMAC", await actionKey(), decodeBase64Url(signature), new TextEncoder().encode(payload));
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { targetId: string; action: "book"; expires: number };
    return parsed.expires > Date.now() && parsed.action === "book" ? parsed : null;
  } catch { return null; }
}
