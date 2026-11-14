import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchShelfInventory } from "@/features/shelf-management/services/shelfInventoryApi";
import {
  applyOptimisticAssign,
  toShelfPickerOption,
  type ShelfPickerOption,
} from "@/features/shelf-management/utils/shelfCapacity";
import { towerMatches } from "@/features/shelf-management/utils/towerMatch";

export type ShelfStorageFilter = "ambient" | "cold";

export function useShelfPicker(societyId: string) {
  const [options, setOptions] = useState<ShelfPickerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [storageFilter, setStorageFilter] = useState<ShelfStorageFilter>("ambient");
  const [towerWing, setTowerWing] = useState<string | undefined>();

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!societyId) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const inventory = await fetchShelfInventory(societyId);
        if (!active) return;
        setOptions(inventory.map(toShelfPickerOption));
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load shelves");
          setOptions([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [societyId, reloadToken]);

  const towerTagged = useMemo(
    () => options.some((shelf) => Boolean(shelf.towerOrWing?.trim())),
    [options],
  );

  const visible = useMemo(
    () =>
      options
        .filter((shelf) =>
          storageFilter === "cold" ? shelf.isColdStorage : !shelf.isColdStorage,
        )
        .filter((shelf) => {
          // Cold shelves are society-shared; only ambient is tower-scoped.
          if (storageFilter === "cold" || !towerWing || !towerTagged) return true;
          return towerMatches(shelf.towerOrWing, towerWing);
        })
        .sort((a, b) => a.code.localeCompare(b.code)),
    [options, storageFilter, towerTagged, towerWing],
  );

  const rows = useMemo(
    () => [...new Set(visible.map((shelf) => shelf.row))].sort(),
    [visible],
  );

  function findOption(code: string): ShelfPickerOption | undefined {
    return options.find(
      (shelf) => shelf.code.toLowerCase() === code.trim().toLowerCase(),
    );
  }

  function markAssigned(shelfCode: string) {
    setOptions((current) => applyOptimisticAssign(current, shelfCode));
  }

  function preferStorage(isCold: boolean) {
    setStorageFilter(isCold ? "cold" : "ambient");
  }

  function preferTower(tower?: string | null) {
    setTowerWing(tower?.trim() || undefined);
  }

  function optionsForPackage(tower?: string | null, preferCold = false): ShelfPickerOption[] {
    return options
      .filter((shelf) => (preferCold ? shelf.isColdStorage : !shelf.isColdStorage))
      .filter((shelf) => {
        if (preferCold || !tower?.trim() || !towerTagged) return true;
        return towerMatches(shelf.towerOrWing, tower);
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  return {
    options,
    visible,
    rows,
    loading,
    error,
    storageFilter,
    towerWing,
    setStorageFilter,
    preferStorage,
    preferTower,
    optionsForPackage,
    findOption,
    markAssigned,
    reload,
  };
}
