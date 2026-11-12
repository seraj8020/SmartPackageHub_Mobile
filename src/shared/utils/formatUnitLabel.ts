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
