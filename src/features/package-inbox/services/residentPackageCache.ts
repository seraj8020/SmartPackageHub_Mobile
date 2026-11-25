import type { HubPackage } from "@/shared/services/packageApi";

/** Soft TTL so hub home → inbox can reuse the last fetch. */
export const RESIDENT_PACKAGES_CACHE_TTL_MS = 45 * 1000;

interface CacheEntry {
  packages: HubPackage[];
  updatedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedResidentPackages(residentId: string): HubPackage[] | undefined {
  return cache.get(residentId)?.packages;
}

export function isResidentPackagesCacheFresh(residentId: string, now = Date.now()): boolean {
  const entry = cache.get(residentId);
  return Boolean(entry && now - entry.updatedAt < RESIDENT_PACKAGES_CACHE_TTL_MS);
}

export function setCachedResidentPackages(residentId: string, packages: HubPackage[]): void {
  cache.set(residentId, { packages, updatedAt: Date.now() });
}

export function clearResidentPackagesCache(residentId?: string): void {
  if (residentId) cache.delete(residentId);
  else cache.clear();
}
