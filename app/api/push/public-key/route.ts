import { bindings } from "@/lib/server/env";
import { jsonError, requireMember } from "@/lib/server/security";

export async function GET(request: Request) {
  try {
    await requireMember(request);
    const publicKey = bindings().VAPID_PUBLIC_KEY;
    if (!publicKey) return Response.json({ error: "Phone notifications are not configured yet." }, { status: 503 });
    return Response.json({ publicKey });
  } catch (error) { return jsonError(error); }
}
