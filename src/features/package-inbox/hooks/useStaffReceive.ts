import { useCallback, useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  dispatchPackage,
  getSocietyPackages,
  type HubPackage,
} from "@/shared/services/packageApi";
import {
  STAFF_PACKAGES_CACHE_TTL_MS,
  getCachedStaffPackages,
  isStaffPackagesCacheFresh,
  setCachedStaffPackages,
  subscribeToStaffPackages,
  updateCachedStaffPackage,
} from "@/features/package-inbox/services/staffPackageCache";
import { upsertCachedDispatchedPackage } from "@/features/package-handover/services/handoverPackageCache";

export function useStaffReceive(societyId: string) {
  const isFocused = useIsFocused();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hubPackages, setHubPackages] = useState<HubPackage[]>(
    () => getCachedStaffPackages(societyId) ?? [],
  );
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageLoadError, setPackageLoadError] = useState<string | null>(null);

  useEffect(() => subscribeToStaffPackages(societyId, setHubPackages), [societyId]);

  const [reloadPackages, setReloadPackages] = useState(0);
  useEffect(() => {
    if (!isFocused) return;
    let mounted = true;
    async function load(force: boolean, showSpinner: boolean) {
      if (!societyId) {
        setHubPackages([]);
        setPackageLoadError("Society session is missing. Sign in again.");
        setLoadingPackages(false);
        return;
      }

      const cachedPackages = getCachedStaffPackages(societyId);
      if (cachedPackages) setHubPackages(cachedPackages);
      if (!force && isStaffPackagesCacheFresh(societyId)) {
        setPackageLoadError(null);
        setLoadingPackages(false);
        return;
      }

      if (showSpinner && !cachedPackages) setLoadingPackages(true);
      setPackageLoadError(null);
      try {
        const data = await getSocietyPackages(societyId);
        if (!mounted) return;
        setCachedStaffPackages(societyId, data);
        setHubPackages(data);
      } catch (err) {
        if (mounted && !cachedPackages) setPackageLoadError(err instanceof Error ? err.message : "Unable to load packages");
      } finally {
        if (mounted) setLoadingPackages(false);
      }
    }

    void load(reloadPackages > 0, true);
    // Only poll while Receive/Shelf is focused — avoids background refetch fighting image loads.
    const timer = setInterval(() => void load(true, false), STAFF_PACKAGES_CACHE_TTL_MS);
    return () => { mounted = false; clearInterval(timer); };
  }, [societyId, reloadPackages, isFocused]);

  const reload = useCallback(() => setReloadPackages((value) => value + 1), []);

  const markShelved = useCallback(
    (pkg: HubPackage, shelfCode: string, isColdStorage: boolean) => {
      const shelved: HubPackage = {
        ...pkg,
        status: "Shelved",
        shelfCode,
        isColdStorage,
      };
      updateCachedStaffPackage(societyId, shelved);
      setHubPackages(getCachedStaffPackages(societyId) ?? []);
    },
    [societyId],
  );

  async function dispatch(pkg: HubPackage): Promise<boolean> {
    setLoadingId(pkg.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[pkg.id];
      return next;
    });

    try {
      const resp = await dispatchPackage(pkg.id);
      if (!resp.success) {
        throw new Error(resp.message ?? "Package dispatch failed.");
      }
      const dispatched: HubPackage = { ...pkg, status: "Dispatched", deliveredAt: undefined };
      updateCachedStaffPackage(societyId, dispatched);
      // Keep Handover list in sync — otherwise it can miss this package for up to the cache TTL.
      upsertCachedDispatchedPackage(societyId, dispatched);
      setHubPackages(getCachedStaffPackages(societyId) ?? []);
      return true;
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [pkg.id]: err instanceof Error ? err.message : "Something went wrong",
      }));
      return false;
    } finally {
      setLoadingId(null);
    }
  }

  return {
    societyId,
    hubPackages,
    loadingPackages,
    packageLoadError,
    loadingId,
    errors,
    dispatch,
    reload,
    markShelved,
  };
}
