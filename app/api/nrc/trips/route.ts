import { searchTrips } from "@/lib/nrc";
import { jsonError, requireMember } from "@/lib/server/security";

export async function GET(request: Request) {
  try {
    await requireMember(request);
    const query = new URL(request.url).searchParams;
    const input = { originId: query.get("originId") || "", destinationId: query.get("destinationId") || "", travelDate: query.get("travelDate") || "", routeId: query.get("routeId") || "" };
    if (Object.values(input).some((value) => !value)) return Response.json({ error: "Route and date are required." }, { status: 400 });
    return Response.json({ trips: await searchTrips(input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
