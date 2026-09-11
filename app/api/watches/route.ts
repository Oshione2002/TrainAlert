import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { jsonError, requireMember } from "@/lib/server/security";
import type { WatchTargetInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    await ensureDatabase();
    const input = await request.json() as { routeId?: string; originId?: string; originName?: string; destinationId?: string; destinationName?: string; travelDate?: string; minimumSeats?: number; targets?: WatchTargetInput[] };
    if (!input.routeId || !input.originId || !input.destinationId || input.originId === input.destinationId || !/^\d{4}-\d{2}-\d{2}$/.test(input.travelDate || "") || !Array.isArray(input.targets) || !input.targets.length) return Response.json({ error: "Complete the journey and select at least one class." }, { status: 400 });
    const min = Math.max(1, Math.min(6, Number(input.minimumSeats || 1)));
    const count = await getRawDb().prepare("SELECT COUNT(*) AS count FROM watches WHERE member_id = ? AND status = 'active'").bind(member.id).first<{ count: number }>();
    if (Number(count?.count || 0) >= 3) return Response.json({ error: "Pause or finish a watch before adding another." }, { status: 409 });
    const watchId = crypto.randomUUID();
    const db = getRawDb();
    const statements = [
      db.prepare("INSERT INTO watches (id, member_id, route_id, origin_id, origin_name, destination_id, destination_name, travel_date, minimum_seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(watchId, member.id, input.routeId, input.originId, String(input.originName || "Origin"), input.destinationId, String(input.destinationName || "Destination"), input.travelDate, min),
      ...input.targets.slice(0, 12).map((target) => db.prepare("INSERT INTO watch_targets (id, watch_id, trip_id, train_name, departure_time, arrival_time, coach_type_id, coach_type_name, fare) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), watchId, target.tripId, target.trainName, target.departureTime, target.arrivalTime, target.coachTypeId, target.coachTypeName, Math.max(0, Number(target.fare || 0)))),
    ];
    await db.batch(statements);
    return Response.json({ id: watchId }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
