import { useCallback, useEffect, useState } from "react";
import {
  dispatchPackage,
  getSocietyPackages,
  type HubPackage,
} from "@/shared/services/packageApi";

export function useStaffReceive(societyId: string) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hubPackages, setHubPackages] = useState<HubPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageLoadError, setPackageLoadError] = useState<string | null>(null);
  const [reloadPackages, setReloadPackages] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load(showSpinner: boolean) {
      if (!societyId) {
        if (!mounted) return;
        setHubPackages([]);
        setPackageLoadError("Society session is missing. Sign in again.");
        setLoadingPackages(false);
        return;
      }
      if (showSpinner) setLoadingPackages(true);
      setPackageLoadError(null);
      try {
        const data = await getSocietyPackages(societyId);
        if (!mounted) return;
        setHubPackages(data);
      } catch (err: unknown) {
        if (mounted) {
          setPackageLoadError(err instanceof Error ? err.message : "Unable to load packages");
        }
      } finally {
        if (mounted && showSpinner) setLoadingPackages(false);
      }
    }

    void load(true);
    const timer = setInterval(() => {
      void load(false);
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [societyId, reloadPackages]);

  const reload = useCallback(() => {
    setReloadPackages((value) => value + 1);
  }, []);

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
  };
}
