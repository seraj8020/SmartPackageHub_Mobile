import type {
  ShelfInventoryItem,
  ShelfPackage,
} from "@/features/shelf-management/models/shelfInventory.types";
import { isHeld24h } from "@/features/shelf-management/utils/shelfAging";

export function normalizeSearch(query: string): string {
  return query.trim().toLowerCase();
}

export function packageMatchesSearch(pkg: ShelfPackage, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return (
    pkg.residentName.toLowerCase().includes(q) ||
    pkg.packageNumber.toLowerCase().includes(q) ||
    pkg.courier.toLowerCase().includes(q)
  );
}

export function shelfMatchesSearch(shelf: ShelfInventoryItem, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  if (shelf.code.toLowerCase().includes(q)) return true;
  return shelf.packages.some((pkg) => packageMatchesSearch(pkg, query));
}

export type StaffShelfTone = "empty" | "occupied" | "full" | "coldHold" | "cold" | "count";

/** Staff tile badge: free vs occupied first; hold only when cold + overdue. */
export function staffShelfBadge(
  shelf: ShelfInventoryItem,
  now: number,
): { label: string; tone: StaffShelfTone } {
  if (shelf.packageCount === 0) {
    return { label: "Free", tone: "empty" };
  }
  if (shelf.isFull) {
    return { label: "Occupied", tone: "full" };
  }
  if (shelf.isColdStorage) {
    const heldCold = shelf.packages.some((pkg) => isHeld24h(pkg.receivedAt, now));
    if (heldCold) {
      return { label: "Cold · hold", tone: "coldHold" };
    }
    return { label: "Cold", tone: "cold" };
  }
  return {
    label: `${shelf.packageCount} on shelf`,
    tone: "occupied",
  };
}
