import { API, authHeaders } from "@/shared/services/apiClient";
import type {
  ShelfInventoryItem,
  ShelfPackage,
} from "@/features/shelf-management/models/shelfInventory.types";

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function mapShelfPackage(pkg: Record<string, unknown>): ShelfPackage {
  return {
    id: textOf(pkg, "id", "Id"),
    residentName: textOf(pkg, "residentName", "ResidentName") || "Resident unavailable",
    packageNumber:
      textOf(pkg, "packageNumber", "PackageNumber", "pkgNumber", "PkgNumber") || "—",
    courier: textOf(pkg, "courier", "Courier") || "Courier",
    receivedAt: textOf(pkg, "receivedAt", "ReceivedAt"),
  };
}

export function mapShelfInventoryRow(row: Record<string, unknown>): ShelfInventoryItem {
  const packagesRaw = (row.packages ?? row.Packages) as Array<Record<string, unknown>> | undefined;
  return {
    id: textOf(row, "id", "Id"),
    code: textOf(row, "code", "Code"),
    towerOrWing: textOf(row, "towerOrWing", "TowerOrWing") || undefined,
    capacity: Number(row.capacity ?? row.Capacity) || 0,
    packageCount: Number(row.packageCount ?? row.PackageCount) || 0,
    isFull: row.isFull === true || row.IsFull === true,
    isColdStorage: row.isColdStorage === true || row.IsColdStorage === true,
    packages: (packagesRaw ?? []).map(mapShelfPackage),
  };
}

export async function fetchShelfInventory(societyId: string): Promise<ShelfInventoryItem[]> {
  const response = await fetch(
    `${API}/societies/${encodeURIComponent(societyId)}/shelf-inventory`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Unable to load shelf inventory (${response.status})`);
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map(mapShelfInventoryRow);
}
