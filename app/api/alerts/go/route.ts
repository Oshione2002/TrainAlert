import { completeWatchForTarget } from "@/lib/server/data";
import { verifyAction } from "@/lib/server/security";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const action = await verifyAction(token);
  if (!action) return new Response("This booking link is invalid or expired.", { status: 403 });
  await completeWatchForTarget(action.targetId);
  return Response.redirect("https://nrc.gsds.ng/", 302);
}
