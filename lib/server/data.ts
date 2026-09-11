import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import type { WatchView } from "@/lib/types";

type WatchRow = Omit<WatchView, "targets"> & { memberId: string };
type TargetRow = WatchView["targets"][number] & { watchId: string };

export async function listWatches(memberId: string): Promise<WatchView[]> {
  await ensureDatabase();
  const db = getRawDb();
  const watchResult = await db.prepare(`
    SELECT id, member_id AS memberId, origin_name AS originName, destination_name AS destinationName,
      travel_date AS travelDate, minimum_seats AS minimumSeats, status,
      last_checked_at AS lastCheckedAt, last_error AS lastError, created_at AS createdAt
    FROM watches WHERE member_id = ? ORDER BY created_at DESC
  `).bind(memberId).all<WatchRow>();
  const watches = watchResult.results || [];
  if (!watches.length) return [];
  const targetResult = await db.prepare(`
    SELECT wt.id, wt.watch_id AS watchId, wt.trip_id AS tripId, wt.train_name AS trainName,
      wt.departure_time AS departureTime, wt.arrival_time AS arrivalTime,
      wt.coach_type_id AS coachTypeId, wt.coach_type_name AS coachTypeName,
      wt.fare, wt.last_seats AS lastSeats, wt.is_available AS isAvailable
    FROM watch_targets wt JOIN watches w ON w.id = wt.watch_id
    WHERE w.member_id = ? ORDER BY wt.departure_time, wt.coach_type_name
  `).bind(memberId).all<TargetRow>();
  return watches.map((watch: WatchRow) => ({
    ...watch,
    targets: (targetResult.results || []).filter((target: TargetRow) => target.watchId === watch.id).map((target: TargetRow) => ({ ...target, isAvailable: Boolean(target.isAvailable) })),
  }));
}

export async function completeWatchForTarget(targetId: string, memberId?: string) {
  await ensureDatabase();
  const db = getRawDb();
  const result = memberId
    ? await db.prepare(`UPDATE watches SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE member_id = ? AND id = (SELECT watch_id FROM watch_targets WHERE id = ?)`).bind(memberId, targetId).run()
    : await db.prepare(`UPDATE watches SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT watch_id FROM watch_targets WHERE id = ?)`).bind(targetId).run();
  return Number(result.meta.changes || 0) > 0;
}
