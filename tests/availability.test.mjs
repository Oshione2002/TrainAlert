import assert from "node:assert/strict";
import test from "node:test";
import { decideAvailability } from "../lib/availability.ts";

test("starts an episode and notifies when the threshold is reached", () => {
  assert.deepEqual(decideAvailability({ seats: 2, minimumSeats: 2, wasAvailable: false, lastNotifiedAt: null, now: 1_000_000 }), {
    available: true, startsEpisode: true, clearsEpisode: false, shouldNotify: true,
  });
});

test("repeats only after the two-minute reminder window", () => {
  const recent = new Date(900_000).toISOString();
  assert.equal(decideAvailability({ seats: 4, minimumSeats: 1, wasAvailable: true, lastNotifiedAt: recent, now: 1_000_000 }).shouldNotify, false);
  assert.equal(decideAvailability({ seats: 4, minimumSeats: 1, wasAvailable: true, lastNotifiedAt: recent, now: 1_020_000 }).shouldNotify, true);
});

test("clears an episode when seats sell out", () => {
  const result = decideAvailability({ seats: 0, minimumSeats: 1, wasAvailable: true, lastNotifiedAt: new Date().toISOString(), now: Date.now() });
  assert.equal(result.available, false);
  assert.equal(result.clearsEpisode, true);
  assert.equal(result.shouldNotify, false);
});
