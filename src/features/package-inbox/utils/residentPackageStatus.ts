import type { HubPackage } from "@/shared/services/packageApi";

/**
 * Resident Inbox / Home counts: anything still open before delivery
 * (Shelved at hub or Dispatched / out for delivery).
 */
export function isResidentInboxPackage(pkg: Pick<HubPackage, "status">): boolean {
  const status = pkg.status ?? "Shelved";
  return status === "Shelved" || status === "Dispatched";
}

/** Alias used for notification badge — same open-before-delivery set. */
export const isResidentAwaitingPackage = isResidentInboxPackage;
