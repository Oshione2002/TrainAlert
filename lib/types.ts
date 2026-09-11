export type Station = { id: string; name: string; code: string };
export type RouteGroup = { routeId: string; routeName: string; stations: { fromStation: Station[]; toStation: Station[] } };
export type Coach = { coachTypeId: string; coachTypeName: string; availableSeats: number; fare: number };
export type Trip = {
  tripId: string;
  vehicleName: string;
  vehicleCode: string;
  tripDate: string;
  departureTime: string;
  arrivalTime: string;
  coaches: Coach[];
};
export type WatchTargetInput = {
  tripId: string;
  trainName: string;
  departureTime: string;
  arrivalTime: string;
  coachTypeId: string;
  coachTypeName: string;
  fare: number;
};
export type WatchView = {
  id: string;
  originName: string;
  destinationName: string;
  travelDate: string;
  minimumSeats: number;
  status: "active" | "paused" | "completed" | "expired";
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  targets: Array<WatchTargetInput & { id: string; lastSeats: number; isAvailable: boolean }>;
};
