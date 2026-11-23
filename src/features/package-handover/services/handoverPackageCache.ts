import type { HubPackage } from "@/shared/services/packageApi";

/** Background refresh / freshness window. Mutations still update caches immediately. */
export const DISPATCHED_PACKAGES_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  packages: HubPackage[];
  updatedAt: number;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<(packages: HubPackage[]) => void>>();

function notify(societyId: string, packages: HubPackage[]): void {
  listeners.get(societyId)?.forEach((listener) => listener(packages));
}

export function subscribeToDispatchedPackages(
  societyId: string,
  listener: (packages: HubPackage[]) => void,
): () => void {
  const societyListeners = listeners.get(societyId) ?? new Set();
  societyListeners.add(listener);
  listeners.set(societyId, societyListeners);
  return () => {
    societyListeners.delete(listener);
    if (societyListeners.size === 0) listeners.delete(societyId);
  };
}

export function getCachedDispatchedPackages(societyId: string): HubPackage[] | undefined {
  return cache.get(societyId)?.packages;
}

export function isDispatchedPackagesCacheFresh(societyId: string, now = Date.now()): boolean {
  const entry = cache.get(societyId);
  return Boolean(entry && now - entry.updatedAt < DISPATCHED_PACKAGES_CACHE_TTL_MS);
}

export function setCachedDispatchedPackages(societyId: string, packages: HubPackage[]): void {
  cache.set(societyId, { packages, updatedAt: Date.now() });
  notify(societyId, packages);
}

/** Insert or replace a dispatched package so Handover sees Shelved → Dispatched immediately. */
export function upsertCachedDispatchedPackage(societyId: string, updatedPackage: HubPackage): void {
  const packages = cache.get(societyId)?.packages ?? [];
  const exists = packages.some((pkg) => pkg.id === updatedPackage.id);
  setCachedDispatchedPackages(
    societyId,
    exists
      ? packages.map((pkg) => (pkg.id === updatedPackage.id ? updatedPackage : pkg))
      : [updatedPackage, ...packages],
  );
}

export function removeCachedDispatchedPackage(societyId: string, packageId: string): void {
  const packages = cache.get(societyId)?.packages;
  if (!packages) return;
  setCachedDispatchedPackages(
    societyId,
    packages.filter((pkg) => pkg.id !== packageId),
  );
}

export function invalidateDispatchedPackagesCache(societyId: string): void {
  cache.delete(societyId);
  notify(societyId, []);
}
