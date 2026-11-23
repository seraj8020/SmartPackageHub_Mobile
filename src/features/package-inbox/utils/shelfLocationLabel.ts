import type { HubPackage } from "@/shared/services/packageApi";
import { formatTowerLabel } from "@/shared/utils/formatUnitLabel";

/** Short hub slot line for resident inbox / preference screens. */
export function shelfCollectLabel(pkg: Pick<HubPackage, "shelfCode">): string | null {
  const code = pkg.shelfCode?.trim();
  return code ? `Collect from ${code}` : null;
}

/** Strip leading Tower/Wing/Block so "Tower A" and "A" compare equal. */
function towerToken(value?: string | null): string {
  return (value ?? "")
    .trim()
    .replace(/^(tower|twr|wing|block|blk)\s+/i, "")
    .trim()
    .toLowerCase();
}

/** Tower · Zone · Rack · Tier breakdown when shelf metadata is present. */
export function shelfLocationDetail(
  pkg: Pick<
    HubPackage,
    "shelfTowerOrWing" | "shelfZone" | "shelfAisle" | "shelfTier" | "isColdStorage"
  >,
): string | null {
  const parts: string[] = [];
  const tower = pkg.shelfTowerOrWing?.trim();
  const zone = pkg.shelfZone?.trim();
  const aisle = pkg.shelfAisle?.trim();
  // Handles "Tower A", "A", "Tower 1", "1" without "Tower Tower A".
  if (tower) parts.push(formatTowerLabel(tower));
  if (zone && towerToken(zone) !== towerToken(tower)) {
    parts.push(`Zone ${zone.replace(/^(zone)\s+/i, "").trim() || zone}`);
  }
  if (aisle) {
    const rack = aisle.replace(/^(aisle|rack)\s+/i, "").trim() || aisle;
    parts.push(`Rack ${rack}`);
  }
  if (pkg.shelfTier != null && pkg.shelfTier > 0) parts.push(`Tier ${pkg.shelfTier}`);
  if (pkg.isColdStorage) parts.push("Cold");
  return parts.length > 0 ? parts.join(" · ") : null;
}
