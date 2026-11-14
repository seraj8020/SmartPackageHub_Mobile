export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseReceivedAt(receivedAt?: string | null): number | null {
  if (!receivedAt?.trim()) return null;
  const raw = receivedAt.trim();
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const asUtc = Date.parse(raw.endsWith("Z") ? raw : `${raw}Z`);
  return Number.isFinite(asUtc) ? asUtc : null;
}

export function hoursAtHub(receivedAt: string | null | undefined, now: number): number {
  const time = parseReceivedAt(receivedAt);
  return time == null ? 0 : Math.max(0, (now - time) / 3_600_000);
}

export function isHeld24h(receivedAt: string | null | undefined, now: number): boolean {
  return hoursAtHub(receivedAt, now) >= 24;
}

/** Staff map hold label (hours / days). */
export function heldLabel(receivedAt: string | null | undefined, now: number): string {
  const hours = Math.floor(hoursAtHub(receivedAt, now));
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 24) return `${Math.floor(hours / 24)}d`;
  return `${hours} hours`;
}
