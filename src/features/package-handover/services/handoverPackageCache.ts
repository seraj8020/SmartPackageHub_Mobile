import type { HubPackage } from "@/shared/services/packageApi";

export const DISPATCHED_PACKAGES_CACHE_TTL_MS = 2 * 60 * 1000;

interface CacheEntry {
  packages: HubPackage[];
  updatedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedDispatchedPackages(societyId: string): HubPackage[] | undefined {
  const entry = cache.get(societyId);
  return entry?.packages;
}

export function isDispatchedPackagesCacheFresh(societyId: string, now = Date.now()): boolean {
  const entry = cache.get(societyId);
  return Boolean(entry && now - entry.updatedAt < DISPATCHED_PACKAGES_CACHE_TTL_MS);
}

export function setCachedDispatchedPackages(societyId: string, packages: HubPackage[]): void {
  cache.set(societyId, { packages, updatedAt: Date.now() });
}

export function invalidateDispatchedPackagesCache(societyId: string): void {
  cache.delete(societyId);
}
