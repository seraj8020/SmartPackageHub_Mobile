import type { HubPackage } from "@/shared/services/packageApi";

/** Packages listed on Runner / Out for delivery (shelved with a tower). */
export function isRunnerRouteEligible(pkg: HubPackage): boolean {
  return (
    pkg.status?.trim().toLowerCase() === "shelved" &&
    Boolean((pkg.tower || pkg.towerWing)?.trim())
  );
}

/** Packages on Handover / currently out with the runner. */
export function isStaffOutForDelivery(pkg: HubPackage): boolean {
  return (pkg.status ?? "").trim().toLowerCase() === "dispatched" && !pkg.deliveredAt;
}
