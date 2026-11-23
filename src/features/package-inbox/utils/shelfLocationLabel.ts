import type { HubPackage } from "@/shared/services/packageApi";

/** Short hub slot line for resident inbox / preference screens. */
export function shelfCollectLabel(pkg: Pick<HubPackage, "shelfCode">): string | null {
  const code = pkg.shelfCode?.trim();
  return code ? `Collect from ${code}` : null;
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
  if (tower) parts.push(`Tower ${tower}`);
  if (zone && zone.toLowerCase() !== tower?.toLowerCase()) parts.push(`Zone ${zone}`);
  if (aisle) parts.push(`Rack ${aisle}`);
  if (pkg.shelfTier != null && pkg.shelfTier > 0) parts.push(`Tier ${pkg.shelfTier}`);
  if (pkg.isColdStorage) parts.push("Cold");
  return parts.length > 0 ? parts.join(" · ") : null;
}
