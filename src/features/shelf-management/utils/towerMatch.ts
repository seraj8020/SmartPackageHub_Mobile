/** Normalize tower labels so "Tower 4", "4", "T4" match admin shelf TowerOrWing. */
export function cleanTower(value?: string | null): string | null {
  if (!value?.trim()) return null;
  let cleaned = value
    .trim()
    .replace(/^(?:tower|twr|wing|block|blk)\s*/i, "")
    .trim()
    .toUpperCase();

  cleaned = (
    {
      NORTH: "N",
      SOUTH: "S",
      EAST: "E",
      WEST: "W",
      NORTHEAST: "NE",
      NORTHWEST: "NW",
      SOUTHEAST: "SE",
      SOUTHWEST: "SW",
    } as Record<string, string>
  )[cleaned] ?? cleaned;

  if (/^T\d{1,2}$/.test(cleaned)) cleaned = cleaned.slice(1);
  return /^[A-Z0-9]{1,12}$/.test(cleaned) ? cleaned : cleaned || null;
}

function awhoTowerCore(value: string): string {
  const v = value.trim().toUpperCase();
  if (v.length >= 2 && v.length <= 3 && v.endsWith("T") && /^\d+$/.test(v.slice(0, -1))) {
    return v.slice(0, -1);
  }
  return v;
}

/** Same tolerant rules as API ResidentMatcher.TowerEquals. */
export function towerMatches(shelfTower?: string | null, residentTower?: string | null): boolean {
  if (!shelfTower?.trim() || !residentTower?.trim()) return false;
  if (shelfTower.trim().toLowerCase() === residentTower.trim().toLowerCase()) return true;

  const cleanedShelf = cleanTower(shelfTower);
  const cleanedResident = cleanTower(residentTower) ?? residentTower.trim();
  if (cleanedShelf && cleanedShelf.toLowerCase() === cleanedResident.toLowerCase()) return true;

  if (
    awhoTowerCore(cleanedShelf ?? shelfTower).toLowerCase() ===
    awhoTowerCore(cleanedResident).toLowerCase()
  ) {
    return true;
  }

  const last = shelfTower.trim().split(/\s+/).at(-1);
  return Boolean(last && last.toLowerCase() === cleanedResident.toLowerCase());
}
