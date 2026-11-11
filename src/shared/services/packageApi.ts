import { API, authHeaders } from "@/shared/services/apiClient";

export interface Society {
  id: string;
  name: string;
}

export interface HubPackage {
  id: string;
  residentId?: string;
  trackingNumber?: string;
  recipientName?: string;
  receivedAt: string;
  courier?: string;
  status?: string;
  towerWing?: string;
  flatNumber?: string;
  shelfCode?: string;
}

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toHubPackage(row: Record<string, unknown>): HubPackage {
  return {
    id: textOf(row, "id", "Id"),
    residentId: textOf(row, "residentId", "ResidentId") || undefined,
    trackingNumber: textOf(row, "trackingNumber", "TrackingNumber") || undefined,
    recipientName: textOf(row, "recipientName", "RecipientName") || undefined,
    receivedAt: textOf(row, "receivedAt", "ReceivedAt") || new Date().toISOString(),
    courier: textOf(row, "courier", "Courier") || undefined,
    status: textOf(row, "status", "Status") || "Shelved",
    towerWing: textOf(row, "towerWing", "TowerWing") || undefined,
    flatNumber: textOf(row, "flatNumber", "FlatNumber") || undefined,
    shelfCode: textOf(row, "shelfCode", "ShelfCode") || undefined,
  };
}

export async function getSocieties(): Promise<Society[]> {
  const response = await fetch(`${API}/societies`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(err.message ?? err.Message ?? `Failed to fetch societies (${response.status})`);
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: textOf(row, "id", "Id"),
    name: textOf(row, "name", "Name"),
  }));
}

export async function getResidentPackages(residentId: string): Promise<HubPackage[]> {
  const response = await fetch(
    `${API}/residents/${encodeURIComponent(residentId)}/packages`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(
      err.message ?? err.Message ?? `Failed to fetch resident packages (${response.status})`,
    );
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map(toHubPackage);
}
