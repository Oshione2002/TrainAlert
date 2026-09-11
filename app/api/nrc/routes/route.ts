import { fetchBookingWindow, fetchRoutes } from "@/lib/nrc";
import { jsonError, requireMember } from "@/lib/server/security";

export async function GET(request: Request) {
  try {
    await requireMember(request);
    const [routes, maxDays] = await Promise.all([fetchRoutes(), fetchBookingWindow()]);
    return Response.json({ routes, maxDays }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) { return jsonError(error); }
}
