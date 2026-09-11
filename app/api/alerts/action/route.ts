import { completeWatchForTarget } from "@/lib/server/data";
import { jsonError, requireMember } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    const input = await request.json() as { targetId?: string; action?: string };
    if (!input.targetId || !["book", "end"].includes(input.action || "")) return Response.json({ error: "Invalid alert action." }, { status: 400 });
    const completed = await completeWatchForTarget(input.targetId, member.id);
    return completed ? Response.json({ ok: true }) : Response.json({ error: "Alert not found." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}
