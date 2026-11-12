import { API, authHeaders } from "@/shared/services/apiClient";

export interface Society {
  id: string;
  name: string;
}

export type PackageLifecycleStatus = "Received" | "Shelved" | "Dispatched" | "Delivered" | string;
export type CodApprovalStatus = "None" | "Pending" | "Approved" | "Rejected" | string;

export interface HubPackage {
  id: string;
  residentId?: string;
  staffUserId?: string;
  recipientName?: string;
  courier: string;
  tracking: string;
  /** Alias used by older mobile screens. */
  trackingNumber?: string;
  tower?: string;
  towerWing?: string;
  floor?: number;
  flat: string;
  flatNumber?: string;
  weight: string;
  receivedAt: string;
  deliveredAt?: string;
  category: string;
  shelfCode?: string;
  shelfCapacity?: number;
  isColdStorage?: boolean;
  status?: PackageLifecycleStatus;
  isCod?: boolean;
  codAmount?: number;
  codApprovalStatus?: CodApprovalStatus;
  pkgNumber?: string;
  deliverySlotStatus?: string;
  deliverySlotLabel?: string;
  preferredDeliveryMethod?: "DoorDelivery" | "CounterPickup" | string;
}

export interface PackageStatusUpdateResponse {
  success: boolean;
  packageId: string;
  message?: string;
}

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function toHubPackage(row: Record<string, unknown>): HubPackage {
  const tower = textOf(row, "towerWing", "TowerWing", "tower", "Tower");
  const flat = textOf(row, "flatNumber", "FlatNumber", "flat", "Flat");
  const floorValue = row.floor ?? row.Floor;
  const weight = textOf(row, "weight", "Weight");
  const tracking =
    textOf(row, "tracking", "Tracking", "trackingNumber", "TrackingNumber", "pkgNumber", "PkgNumber") ||
    "—";
  const isCodRaw = row.isCod ?? row.IsCod;
  const codAmountRaw = row.codAmount ?? row.CodAmount;
  return {
    id: textOf(row, "id", "Id"),
    residentId: textOf(row, "residentId", "ResidentId") || undefined,
    staffUserId: textOf(row, "staffUserId", "StaffUserId") || undefined,
    recipientName: textOf(row, "recipientName", "RecipientName") || undefined,
    courier: textOf(row, "courier", "Courier", "courierPartner") || "Courier",
    tracking,
    trackingNumber: tracking,
    tower: tower || undefined,
    towerWing: tower || undefined,
    floor: typeof floorValue === "number" && Number.isFinite(floorValue) ? floorValue : undefined,
    flat,
    flatNumber: flat || undefined,
    weight: weight ? `${weight.replace(/\s*kg$/i, "")} kg` : "",
    receivedAt:
      textOf(row, "receivedAt", "ReceivedAt", "recievedAt", "RecievedAt") ||
      new Date().toISOString(),
    deliveredAt: textOf(row, "deliveredAt", "DeliveredAt") || undefined,
    category: textOf(row, "category", "Category", "description") || "Miscellaneous",
    shelfCode: textOf(row, "shelfCode", "ShelfCode") || undefined,
    shelfCapacity: Number(row.shelfCapacity ?? row.ShelfCapacity) || undefined,
    isColdStorage: row.isColdStorage === true || row.IsColdStorage === true,
    status: textOf(row, "status", "Status") || undefined,
    isCod: typeof isCodRaw === "boolean" ? isCodRaw : undefined,
    codAmount:
      typeof codAmountRaw === "number" ? codAmountRaw : Number(codAmountRaw) || undefined,
    codApprovalStatus: textOf(row, "codApprovalStatus", "CodApprovalStatus") || undefined,
    pkgNumber: textOf(row, "pkgNumber", "PkgNumber") || undefined,
    deliverySlotStatus: textOf(row, "deliverySlotStatus", "DeliverySlotStatus") || undefined,
    deliverySlotLabel: textOf(row, "deliverySlotLabel", "DeliverySlotLabel") || undefined,
    preferredDeliveryMethod:
      textOf(row, "preferredDeliveryMethod", "PreferredDeliveryMethod") || undefined,
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

export async function getSocietyPackages(societyId: string): Promise<HubPackage[]> {
  const response = await fetch(
    `${API}/societies/${encodeURIComponent(societyId)}/packages`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(
      err.message ?? err.Message ?? `Failed to fetch society packages (${response.status})`,
    );
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map(toHubPackage);
}

export async function dispatchPackage(
  packageId: string,
): Promise<PackageStatusUpdateResponse> {
  const response = await fetch(`${API}/packages/${encodeURIComponent(packageId)}/dispatch`, {
    method: "PUT",
    headers: await authHeaders(),
  });
  const result = (await response.json().catch(() => undefined)) as
    | boolean
    | {
        success?: boolean;
        Success?: boolean;
        message?: string;
        Message?: string;
      }
    | undefined;
  const body = typeof result === "object" && result !== null ? result : undefined;
  const message = body?.message ?? body?.Message;
  const succeeded = result === true || body?.success === true || body?.Success === true;

  if (!response.ok) {
    throw new Error(message ?? `Package dispatch failed (${response.status})`);
  }
  if (!succeeded) {
    throw new Error(message ?? "Package dispatch failed.");
  }
  return { success: true, packageId, message };
}
