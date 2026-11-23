export function toDateOnly(value?: string | null): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function toApiDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

export function formatHoldRange(startDate: string, endDate: string): string {
  return `${formatShort(startDate)} to ${formatShort(endDate)}`;
}

function formatShort(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function validateHoldDates(startDate: string, endDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return "Enter both dates in YYYY-MM-DD format.";
  }
  if (endDate <= startDate) return "End date must be after the start date.";
  if (startDate < toDateOnly(new Date().toISOString())) {
    return "Start date cannot be before today.";
  }
  return null;
}

/** True when an active hold's date range includes today (UTC calendar day). */
export function isHoldCoveringToday(hold?: {
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
} | null): boolean {
  if (!hold?.isActive) return false;
  const today = toDateOnly(new Date().toISOString());
  const start = toDateOnly(hold.startDate);
  const end = toDateOnly(hold.endDate);
  if (!start || !end) return false;
  return start <= today && today <= end;
}
