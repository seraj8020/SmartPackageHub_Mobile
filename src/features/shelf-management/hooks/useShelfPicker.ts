import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchShelfInventory } from "@/features/shelf-management/services/shelfInventoryApi";
import {
  applyOptimisticAssign,
  toShelfPickerOption,
  type ShelfPickerOption,
} from "@/features/shelf-management/utils/shelfCapacity";

export type ShelfStorageFilter = "ambient" | "cold";

export function useShelfPicker(societyId: string) {
  const [options, setOptions] = useState<ShelfPickerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [storageFilter, setStorageFilter] = useState<ShelfStorageFilter>("ambient");

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

  const visible = useMemo(
    () =>
      options
        .filter((shelf) =>
          storageFilter === "cold" ? shelf.isColdStorage : !shelf.isColdStorage,
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [options, storageFilter],
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

  return {
    options,
    visible,
    rows,
    loading,
    error,
    storageFilter,
    setStorageFilter,
    preferStorage,
    findOption,
    markAssigned,
    reload,
  };
}
