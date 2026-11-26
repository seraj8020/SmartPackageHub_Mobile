import type { HistoryItem, HubPackage } from "@/shared/services/packageApi";

/** Map a history row into the HubPackage shape used by PackageDetail. */
export function historyItemToHubPackage(item: HistoryItem): HubPackage {
  return {
    id: item.packageId || item.id,
    courier: item.courier || "Courier",
    tracking: item.trackingNumber || item.pkgNumber || item.packageId || "",
    trackingNumber: item.trackingNumber,
    courierAwb: item.courierAwb,
    flat: "",
    weight: "",
    receivedAt: item.collectedAt,
    deliveredAt: item.collectedAt,
    category: item.category || "Miscellaneous",
    pkgNumber: item.pkgNumber,
    status: item.packageStatus || item.status || "Delivered",
  };
}
