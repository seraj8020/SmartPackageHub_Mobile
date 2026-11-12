import { API, authHeaders } from "@/shared/services/apiClient";
import type {
  BookDeliverySlotRequest,
  DeliverySlotAvailability,
  DeliverySlotBooking,
  DeliverySlotWindow,
} from "@/features/delivery-slots/models/deliverySlot.types";

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

function numberOf(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function boolOf(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

function toWindow(row: Record<string, unknown>): DeliverySlotWindow {
  return {
    windowStart: textOf(row, "windowStart", "WindowStart"),
    windowEnd: textOf(row, "windowEnd", "WindowEnd"),
    label: textOf(row, "label", "Label"),
    capacity: numberOf(row, "capacity", "Capacity"),
    bookedCount: numberOf(row, "bookedCount", "BookedCount"),
    remaining: numberOf(row, "remaining", "Remaining"),
    isFull: boolOf(row, "isFull", "IsFull") || numberOf(row, "remaining", "Remaining") === 0,
    isDefaultWindow: boolOf(row, "isDefaultWindow", "IsDefaultWindow"),
  };
}

function toAvailability(row: Record<string, unknown>): DeliverySlotAvailability {
  const windowsRaw = (row.windows ?? row.Windows ?? []) as Array<Record<string, unknown>>;
  return {
    date: textOf(row, "date", "Date"),
    windows: Array.isArray(windowsRaw) ? windowsRaw.map(toWindow) : [],
  };
}

function toBooking(row: Record<string, unknown>): DeliverySlotBooking {
  return {
    id: textOf(row, "id", "Id"),
    societyId: textOf(row, "societyId", "SocietyId"),
    residentId: textOf(row, "residentId", "ResidentId"),
    packageId: textOf(row, "packageId", "PackageId"),
    windowStart: textOf(row, "windowStart", "WindowStart"),
    windowEnd: textOf(row, "windowEnd", "WindowEnd"),
    status: textOf(row, "status", "Status") || "booked",
    notes: textOf(row, "notes", "Notes"),
    pkgNumber: textOf(row, "pkgNumber", "PkgNumber") || undefined,
    courier: textOf(row, "courier", "Courier") || undefined,
  };
}

export async function getDeliverySlotAvailability(
  societyId: string,
  date: string,
): Promise<DeliverySlotAvailability> {
  const url =
    `${API}/delivery-slots/availability` +
    `?societyId=${encodeURIComponent(societyId)}` +
    `&date=${encodeURIComponent(date)}`;
  const response = await fetch(url, { headers: await authHeaders() });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(
      err.message ?? err.Message ?? `Failed to load slot availability (${response.status})`,
    );
  }
  const body = (await response.json()) as Record<string, unknown>;
  return toAvailability(body);
}

export async function bookDeliverySlot(
  request: BookDeliverySlotRequest,
): Promise<DeliverySlotBooking> {
  const response = await fetch(`${API}/delivery-slots`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      societyId: request.societyId,
      residentId: request.residentId,
      packageId: request.packageId,
      windowStart: request.windowStart ?? new Date(0).toISOString(),
      windowEnd: request.windowEnd ?? new Date(0).toISOString(),
      notes: request.notes ?? "",
      preferredDeliveryMethod: request.preferredDeliveryMethod,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const message = textOf(body, "message", "Message");

  if (response.status === 409) {
    const slot = (body.slot ?? body.Slot) as Record<string, unknown> | undefined;
    const err = new Error(message || "This delivery window is unavailable.");
    (err as Error & { booking?: DeliverySlotBooking }).booking = slot
      ? toBooking(slot)
      : undefined;
    throw err;
  }

  if (!response.ok) {
    throw new Error(message || `Failed to book delivery slot (${response.status})`);
  }

  // Counter pickup saves preference without creating a door slot.
  if (!textOf(body, "id", "Id") && request.preferredDeliveryMethod === "CounterPickup") {
    return {
      id: "",
      societyId: request.societyId,
      residentId: request.residentId,
      packageId: request.packageId,
      windowStart: "",
      windowEnd: "",
      status: "counter",
      notes: message || "Counter pickup selected",
    };
  }

  return toBooking(body);
}
