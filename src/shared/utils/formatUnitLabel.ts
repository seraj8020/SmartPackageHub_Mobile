export function formatUnitLabel(
  tower?: string | null,
  flat?: string | null,
): string {
  const t = (tower ?? "").trim();
  const f = (flat ?? "").trim();
  if (t && f) return `${t}-${f}`;
  if (f) return f;
  if (t) return t;
  return "—";
}

/**
 * Display label for route chips/headers.
 * Avoids "Tower Tower E" when DB value already includes Tower/Wing/Block.
 */
export function formatTowerLabel(tower?: string | null): string {
  const raw = (tower ?? "").trim();
  if (!raw) return "Tower";
  if (/^(tower|twr|wing|block|blk)\b/i.test(raw)) {
    return raw
      .replace(/^(tower|twr)\b/i, "Tower")
      .replace(/^(wing)\b/i, "Wing")
      .replace(/^(block|blk)\b/i, "Block");
  }
  return `Tower ${raw}`;
}
