import type { SaveVacationHoldRequest, VacationHold } from "@/features/vacation-hold/models/vacationHold.types";
import { API, authHeaders } from "@/shared/services/apiClient";

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

function mapHold(row: Record<string, unknown>): VacationHold {
  return {
    id: textOf(row, "id", "Id"),
    societyId: textOf(row, "societyId", "SocietyId"),
    residentId: textOf(row, "residentId", "ResidentId"),
    startDate: textOf(row, "startDate", "StartDate", "fromDate", "FromDate"),
    endDate: textOf(row, "endDate", "EndDate", "toDate", "ToDate"),
    isActive: row.isActive === true || row.IsActive === true,
    towerWing: textOf(row, "towerWing", "TowerWing") || undefined,
    flatNumber: textOf(row, "flatNumber", "FlatNumber") || undefined,
  };
}

async function readError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as { message?: string; Message?: string };
  throw new Error(body.message ?? body.Message ?? fallback);
}

export async function getVacationHold(residentId: string): Promise<VacationHold | null> {
  const response = await fetch(`${API}/residents/${encodeURIComponent(residentId)}/vacationhold`, {
    headers: await authHeaders(),
  });
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) await readError(response, `Unable to load vacation hold (${response.status})`);
  return mapHold((await response.json()) as Record<string, unknown>);
}

export async function saveVacationHold(residentId: string, request: SaveVacationHoldRequest): Promise<void> {
  const response = await fetch(`${API}/residents/${encodeURIComponent(residentId)}/vacationhold`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...request, isActive: true }),
  });
  if (!response.ok) await readError(response, `Unable to save vacation hold (${response.status})`);
}

export async function cancelVacationHold(residentId: string): Promise<void> {
  const response = await fetch(`${API}/residents/${encodeURIComponent(residentId)}/vacationhold/cancel`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Unable to cancel vacation hold (${response.status})`);
}
