export type AvailabilityInput = { seats: number; minimumSeats: number; wasAvailable: boolean; lastNotifiedAt: string | null; now: number };

export function decideAvailability(input: AvailabilityInput) {
  const available = input.seats >= input.minimumSeats;
  const lastNotification = input.lastNotifiedAt ? Date.parse(input.lastNotifiedAt) : 0;
  return {
    available,
    startsEpisode: available && !input.wasAvailable,
    clearsEpisode: !available && input.wasAvailable,
    shouldNotify: available && (!lastNotification || input.now - lastNotification >= 115000),
  };
}
