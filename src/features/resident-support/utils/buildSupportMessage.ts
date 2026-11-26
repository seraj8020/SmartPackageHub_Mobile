import type { SupportContext } from "@/features/resident-support/models/support.types";

/** Builds the email/share body with Traizr-style product context attached. */
export function buildSupportMessage(ctx: SupportContext): string {
  const unit = [ctx.towerWing, ctx.flatNumber].filter(Boolean).join("-") || "—";
  return [
    ctx.message.trim(),
    "",
    "—",
    "SPH resident context (auto-attached)",
    `Topic: ${ctx.topicLabel}`,
    `Resident: ${ctx.residentName}`,
    `Resident ID: ${ctx.residentId}`,
    ctx.phoneNumber ? `Phone: +91 ${ctx.phoneNumber}` : null,
    `Society: ${ctx.societyName} (${ctx.societyId})`,
    `Unit: ${unit}`,
    `Sent from: Smart Package Hub resident app`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export function buildSupportSubject(ctx: SupportContext): string {
  const unit = [ctx.towerWing, ctx.flatNumber].filter(Boolean).join("-");
  const where = unit ? `${ctx.societyName} · ${unit}` : ctx.societyName;
  return `SPH Support: ${ctx.topicLabel} — ${where}`;
}
