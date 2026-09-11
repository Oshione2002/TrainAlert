import type { RouteGroup, Trip } from "./types";

const NRC_API = "https://api.gsds.ng";

type NrcCoach = {
  coachTypeId?: string | number;
  coachTypeName?: string;
  availableSeats?: string | number;
  travellerCategory?: Array<{ name?: string; fareValue?: string | number }>;
};

type NrcTrip = {
  tripId?: string | number;
  vehicleName?: string;
  vehicleCode?: string;
  tripDate?: string;
  fromStation?: { departureTime?: string; arrivalTime?: string };
  toStation?: { arrivalTime?: string; departureTime?: string };
  coaches?: NrcCoach[];
};

async function nrcGet(path: string) {
  const response = await fetch(`${NRC_API}${path}`, {
    headers: { Accept: "application/json", "X-Platform-Identifier": "WEB" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`NRC returned ${response.status}`);
  const body = (await response.json()) as { status?: number; result?: unknown; message?: string };
  if (body.status !== 200 || body.result == null) throw new Error(body.message || "NRC response was incomplete");
  return body.result;
}

export async function fetchRoutes(): Promise<RouteGroup[]> {
  const result = await nrcGet("/search/route-wise-stations");
  if (!Array.isArray(result)) throw new Error("NRC route list was invalid");
  return result as RouteGroup[];
}

export async function fetchBookingWindow(): Promise<number> {
  const result = (await nrcGet("/cs/appConfig/getMaxDaysAllowedForBooking")) as { value?: string };
  const value = Number(result.value);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

export async function searchTrips(input: { originId: string; destinationId: string; travelDate: string; routeId: string }): Promise<Trip[]> {
  const query = new URLSearchParams({
    fromStation: input.originId,
    toStation: input.destinationId,
    travelDate: input.travelDate,
    routeNumber: input.routeId,
  });
  const result = await nrcGet(`/search/search-trips?${query}`);
  if (!Array.isArray(result)) throw new Error("NRC trip list was invalid");
  return (result as NrcTrip[]).map((raw) => ({
    tripId: String(raw.tripId),
    vehicleName: String(raw.vehicleName || "NRC train"),
    vehicleCode: String(raw.vehicleCode || ""),
    tripDate: String(raw.tripDate || input.travelDate),
    departureTime: String(raw.fromStation?.departureTime || raw.fromStation?.arrivalTime || ""),
    arrivalTime: String(raw.toStation?.arrivalTime || raw.toStation?.departureTime || ""),
    coaches: Array.isArray(raw.coaches) ? raw.coaches.map((coach) => ({
      coachTypeId: String(coach.coachTypeId),
      coachTypeName: String(coach.coachTypeName || "Coach"),
      availableSeats: Number(coach.availableSeats || 0),
      fare: Number(coach.travellerCategory?.find((item) => item.name === "Adult")?.fareValue || coach.travellerCategory?.[0]?.fareValue || 0),
    })) : [],
  }));
}
