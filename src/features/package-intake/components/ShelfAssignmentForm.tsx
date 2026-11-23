import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ShelfStorageFilter } from "@/features/shelf-management/hooks/useShelfPicker";
import {
  shelfRowChipLabel,
  type ShelfPickerOption,
} from "@/features/shelf-management/utils/shelfCapacity";
import { colors } from "@/shared/theme/colors";

type Props = {
  shelf: string;
  row: string;
  suggested: string;
  storageFilter: ShelfStorageFilter;
  rows: string[];
  options: ShelfPickerOption[];
  loading?: boolean;
  loadError?: string | null;
  onStorageFilterChange: (filter: ShelfStorageFilter) => void;
  onRowChange: (row: string) => void;
  onShelfChange: (shelf: string) => void;
  onRetryLoad?: () => void;
};

export function ShelfAssignmentForm({
  shelf,
  row,
  suggested,
  storageFilter,
  rows,
  options,
  loading = false,
  loadError = null,
  onStorageFilterChange,
  onRowChange,
  onShelfChange,
  onRetryLoad,
}: Props) {
  const [showOccupied, setShowOccupied] = useState(false);
  const [aisle, setAisle] = useState("");

  const selected = options.find(
    (item) => item.code.toLowerCase() === shelf.trim().toLowerCase(),
  );

  const rowOptions = useMemo(
    () => options.filter((item) => item.row === row),
    [options, row],
  );

  const aisles = useMemo(() => {
    const values = [
      ...new Set(rowOptions.map((item) => item.aisle).filter((value) => Boolean(value))),
    ];
    return values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rowOptions]);

  useEffect(() => {
    if (aisles.length === 0) {
      if (aisle) setAisle("");
      return;
    }
    if (aisle && aisles.includes(aisle)) return;
    const fromSelected = selected?.aisle && aisles.includes(selected.aisle) ? selected.aisle : "";
    const fromSuggested = options.find(
      (item) => item.code.toLowerCase() === suggested.trim().toLowerCase() && item.row === row,
    )?.aisle;
    const preferred =
      fromSelected ||
      (fromSuggested && aisles.includes(fromSuggested) ? fromSuggested : "") ||
      aisles[0];
    setAisle(preferred);
  }, [aisles, aisle, selected?.aisle, suggested, options, row]);

  const aisleOptions = useMemo(() => {
    if (!aisle || aisles.length === 0) return rowOptions;
    return rowOptions.filter((item) => item.aisle === aisle);
  }, [rowOptions, aisle, aisles.length]);

  const visibleOptions = useMemo(() => {
    const list = showOccupied ? aisleOptions : aisleOptions.filter((item) => !item.isFull);
    return [...list].sort((a, b) => {
      if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  }, [aisleOptions, showOccupied]);

  const freeCount = aisleOptions.filter((item) => !item.isFull).length;
  const fullCount = aisleOptions.length - freeCount;

  function pickFirstFreeInAisle(nextAisle: string) {
    const pool = rowOptions.filter((item) => !nextAisle || item.aisle === nextAisle);
    const open =
      pool.find(
        (item) =>
          item.code.toLowerCase() === suggested.trim().toLowerCase() && !item.isFull,
      ) ??
      pool.find((item) => !item.isFull) ??
      null;
    if (open) onShelfChange(open.code);
    else onShelfChange("");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Assign hub slot</Text>
      <Text style={styles.hint}>
        {selected
          ? `${selected.code} · ${selected.isColdStorage ? "Cold" : "Ambient"} · ${
              selected.isFull ? "occupied (unavailable)" : `${selected.remaining} free`
            }`
          : "Pick a free slot. Occupied slots stay reserved until delivery."}
      </Text>

      <View style={styles.tabRow}>
        {(["ambient", "cold"] as const).map((id) => {
          const active = storageFilter === id;
          return (
            <Pressable
              key={id}
              onPress={() => onStorageFilterChange(id)}
              style={[
                styles.tab,
                active && (id === "cold" ? styles.tabCold : styles.tabActive),
              ]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {id === "cold" ? "Cold" : "Ambient"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading free slots…</Text>
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          {onRetryLoad ? (
            <Pressable onPress={onRetryLoad}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : options.length === 0 ? (
        <Text style={styles.muted}>
          {storageFilter === "cold"
            ? "No cold slots configured for this society."
            : "No ambient slots for this resident's tower. Configure matching slots in Admin → Shelves."}
        </Text>
      ) : (
        <>
          {rows.length > 0 ? (
            <View style={styles.tabRow}>
              {rows.map((item) => {
                const active = row === item;
                const label = shelfRowChipLabel(item, options);
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      onRowChange(item);
                      const firstOpen =
                        options.find((opt) => opt.row === item && !opt.isFull) ??
                        options.find((opt) => opt.row === item);
                      if (firstOpen) {
                        onShelfChange(firstOpen.isFull ? "" : firstOpen.code);
                        if (firstOpen.aisle) setAisle(firstOpen.aisle);
                      }
                    }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {aisles.length > 0 ? (
            <View style={styles.tabRow}>
              {aisles.map((item) => {
                const active = aisle === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setAisle(item);
                      pickFirstFreeInAisle(item);
                    }}
                    style={[styles.aisleTab, active && styles.aisleTabActive]}
                  >
                    <Text style={[styles.aisleTabText, active && styles.tabTextActive]}>
                      Rack {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {freeCount} free
              {fullCount > 0 ? ` · ${fullCount} occupied` : ""}
            </Text>
            <Pressable
              onPress={() => setShowOccupied((value) => !value)}
              hitSlop={8}
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {showOccupied ? "Hide occupied" : "Show occupied"}
              </Text>
            </Pressable>
          </View>

          {visibleOptions.length === 0 ? (
            <Text style={styles.muted}>
              {showOccupied
                ? "No slots in this rack."
                : "No free slots here. Show occupied to review, or pick another rack."}
            </Text>
          ) : (
            <View style={styles.grid}>
              {visibleOptions.map((item) => {
                const active = item.code.toLowerCase() === shelf.trim().toLowerCase();
                const suggestedHit =
                  item.code.toLowerCase() === suggested.trim().toLowerCase();
                const disabled = item.isFull;
                return (
                  <Pressable
                    key={item.id || item.code}
                    disabled={disabled}
                    onPress={() => {
                      if (disabled) return;
                      onShelfChange(item.code);
                    }}
                    style={[
                      styles.tile,
                      !disabled && styles.tileFree,
                      disabled && styles.tileFull,
                      active && !disabled && styles.tileActive,
                      suggestedHit && !disabled && !active && styles.tileSuggested,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tileCode,
                        disabled && styles.tileCodeFull,
                        active && !disabled && styles.tileCodeActive,
                      ]}
                    >
                      {item.code}
                    </Text>
                    <Text
                      style={[
                        styles.tileMeta,
                        disabled && styles.tileMetaFull,
                        active && !disabled && styles.tileCodeActive,
                      ]}
                    >
                      {disabled ? "Occupied" : `${item.remaining} free`}
                      {suggestedHit && !disabled ? " · sug" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  title: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hint: { marginTop: 4, fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tab: {
    flexGrow: 1,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.primary },
  tabCold: { backgroundColor: "#0284C7" },
  tabText: { fontSize: 10, fontWeight: "800", color: "#6B7280", textAlign: "center" },
  tabTextActive: { color: "#fff" },
  aisleTab: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  aisleTabActive: { backgroundColor: "#4338CA" },
  aisleTabText: { fontSize: 11, fontWeight: "800", color: "#4338CA" },
  summaryRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  toggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  toggleText: { fontSize: 10, fontWeight: "800", color: colors.primary },
  muted: { marginTop: 12, fontSize: 12, color: "#9CA3AF" },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { fontSize: 12, color: colors.danger },
  retry: { marginTop: 6, fontSize: 11, fontWeight: "800", color: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tile: {
    width: "30%",
    flexGrow: 1,
    minWidth: 88,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  tileFree: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  tileSuggested: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileFull: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    opacity: 0.85,
  },
  tileCode: { fontSize: 13, fontWeight: "800", color: "#065F46" },
  tileCodeFull: { color: "#991B1B" },
  tileCodeActive: { color: "#fff" },
  tileMeta: { marginTop: 2, fontSize: 10, color: "#047857" },
  tileMetaFull: { color: "#B91C1C" },
});
