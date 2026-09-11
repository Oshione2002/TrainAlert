import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { searchTrips } from "@/lib/nrc";
import { decideAvailability } from "@/lib/availability";
import { bindings } from "@/lib/server/env";
import { notifyTarget } from "@/lib/server/notifications";
import { jsonError } from "@/lib/server/security";

type Group = { routeId: string; originId: string; destinationId: string; travelDate: string; failures: number };
type PollWatch = {
  id: string; memberId: string; originName: string; destinationName: string; minimumSeats: number;
};
type PollTarget = {
  id: string; watchId: string; tripId: string; coachTypeId: string; trainName: string; departureTime: string;
  arrivalTime: string; coachTypeName: string; fare: number; isAvailable: number; episodeId: string | null; lastNotifiedAt: string | null;
};

export async function POST(request: Request) {
  try {
    const env = bindings();
    const expected = env.INTERNAL_POLL_SECRET || (new URL(request.url).hostname === "localhost" ? "trainalert-local-poll" : "");
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return new Response("Forbidden", { status: 403 });
    await ensureDatabase();
    const db = getRawDb();
    const watDate = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
    await db.prepare("UPDATE watches SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE status IN ('active','paused') AND travel_date < ?").bind(watDate).run();
    const groupResult = await db.prepare(`
      SELECT route_id AS routeId, origin_id AS originId, destination_id AS destinationId, travel_date AS travelDate,
        MAX(poll_failures) AS failures
      FROM watches
      WHERE status = 'active' AND travel_date >= ? AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)
      GROUP BY route_id, origin_id, destination_id, travel_date
      ORDER BY MIN(COALESCE(next_check_at, created_at)) LIMIT 30
    `).bind(watDate).all<Group>();
    let checked = 0;
    let sent = 0;
    let failed = 0;
    for (const group of groupResult.results || []) {
      try {
        const trips = await searchTrips({ originId: group.originId, destinationId: group.destinationId, travelDate: group.travelDate, routeId: group.routeId });
        const watchResult = await db.prepare(`SELECT id, member_id AS memberId, origin_name AS originName, destination_name AS destinationName, minimum_seats AS minimumSeats FROM watches WHERE status = 'active' AND route_id = ? AND origin_id = ? AND destination_id = ? AND travel_date = ?`)
          .bind(group.routeId, group.originId, group.destinationId, group.travelDate).all<PollWatch>();
        for (const watch of watchResult.results || []) {
          const targetResult = await db.prepare(`SELECT id, watch_id AS watchId, trip_id AS tripId, coach_type_id AS coachTypeId, train_name AS trainName, departure_time AS departureTime, arrival_time AS arrivalTime, coach_type_name AS coachTypeName, fare, is_available AS isAvailable, episode_id AS episodeId, last_notified_at AS lastNotifiedAt FROM watch_targets WHERE watch_id = ?`).bind(watch.id).all<PollTarget>();
          for (const target of targetResult.results || []) {
            const trip = trips.find((item) => item.tripId === target.tripId);
            const coach = trip?.coaches.find((item) => item.coachTypeId === target.coachTypeId);
            const seats = Math.max(0, Number(coach?.availableSeats || 0));
            const priorAvailable = Boolean(target.isAvailable);
            const decision = decideAvailability({ seats, minimumSeats: watch.minimumSeats, wasAvailable: priorAvailable, lastNotifiedAt: target.lastNotifiedAt, now: Date.now() });
            const available = decision.available;
            const episodeId = available ? (priorAvailable && target.episodeId ? target.episodeId : crypto.randomUUID()) : null;
            let notifiedAt = target.lastNotifiedAt;
            if (decision.shouldNotify) {
              const delivered = await notifyTarget({ ...target, memberId: watch.memberId, originName: watch.originName, destinationName: watch.destinationName, travelDate: group.travelDate }, seats, new URL(request.url).origin);
              if (delivered) { notifiedAt = new Date().toISOString(); sent += 1; }
            }
            await db.prepare("UPDATE watch_targets SET last_seats = ?, is_available = ?, episode_id = ?, last_notified_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
              .bind(seats, available ? 1 : 0, episodeId, available ? notifiedAt : null, target.id).run();
          }
          await db.prepare("UPDATE watches SET last_checked_at = CURRENT_TIMESTAMP, last_error = NULL, poll_failures = 0, next_check_at = datetime('now', '+2 minutes'), updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(watch.id).run();
        }
        checked += 1;
      } catch (error) {
        failed += 1;
        const failures = Math.min(4, Number(group.failures || 0) + 1);
        const delay = [4, 8, 16, 30][failures - 1];
        const message = error instanceof Error ? error.message.slice(0, 250) : "NRC check failed";
        await db.prepare(`UPDATE watches SET last_checked_at = CURRENT_TIMESTAMP, last_error = ?, poll_failures = ?, next_check_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP WHERE status = 'active' AND route_id = ? AND origin_id = ? AND destination_id = ? AND travel_date = ?`)
          .bind(message, failures, `+${delay} minutes`, group.routeId, group.originId, group.destinationId, group.travelDate).run();
      }
    }
    return Response.json({ checked, sent, failed });
  } catch (error) { return jsonError(error); }
}
