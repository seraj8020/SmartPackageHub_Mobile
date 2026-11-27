import type { PackageReturnReason } from "@/features/package-returns/models/packageReturn.types";

/** Product labels for return reasons (resident picker + staff/resident display). */
export const PACKAGE_RETURN_REASON_OPTIONS: Array<{ value: PackageReturnReason; label: string }> = [
  { value: "NotAsExpected", label: "Not as expected / don't like" },
  { value: "DamagedInside", label: "Damaged inside" },
  { value: "Expired", label: "Expired" },
  { value: "TechnicalFault", label: "Mechanical / technical fault" },
  { value: "Other", label: "Other" },
];

export function formatPackageReturnReason(reason: string | null | undefined): string {
  if (!reason?.trim()) return "Reason unavailable";
  const match = PACKAGE_RETURN_REASON_OPTIONS.find(
    (option) => option.value.toLowerCase() === reason.trim().toLowerCase(),
  );
  if (match) return match.label;
  return reason.replace(/([a-z])([A-Z])/g, "$1 $2");
}
