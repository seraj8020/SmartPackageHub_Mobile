import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ShelfStorageFilter } from "@/features/shelf-management/hooks/useShelfPicker";
import type { ShelfPickerOption } from "@/features/shelf-management/utils/shelfCapacity";
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
  const selected = options.find(
    (item) => item.code.toLowerCase() === shelf.trim().toLowerCase(),
  );
  const rowOptions = options.filter((item) => item.row === row);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Assign shelf</Text>
      <Text style={styles.hint}>
        {selected
          ? `${selected.code} · ${selected.isColdStorage ? "Cold" : "Ambient"} · ${
              selected.isFull ? "at capacity (still assignable)" : `${selected.remaining} left`
            }`
          : "Pick a shelf code (full shelves remain assignable)"}
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
        <Text style={styles.muted}>Loading shelf free slots…</Text>
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
            ? "No cold shelves configured for this society."
            : "No ambient shelves for this resident's tower. Configure matching shelves in Admin → Shelves."}
        </Text>
      ) : (
        <>
          {rows.length > 0 ? (
            <View style={styles.tabRow}>
              {rows.map((item) => {
                const active = row === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      onRowChange(item);
                      const firstOpen =
                        options.find((opt) => opt.row === item && !opt.isFull) ??
                        options.find((opt) => opt.row === item);
                      if (firstOpen) onShelfChange(firstOpen.code);
                    }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.grid}>
            {rowOptions.map((item) => {
              const active = item.code.toLowerCase() === shelf.trim().toLowerCase();
              const suggestedHit =
                item.code.toLowerCase() === suggested.trim().toLowerCase();
              return (
                <Pressable
                  key={item.id || item.code}
                  onPress={() => onShelfChange(item.code)}
                  style={[
                    styles.tile,
                    active && styles.tileActive,
                    item.isFull && !active && styles.tileFull,
                  ]}
                >
                  <Text style={[styles.tileCode, active && styles.tileCodeActive]}>
                    {item.code}
                  </Text>
                  <Text style={[styles.tileMeta, active && styles.tileCodeActive]}>
                    {item.isFull ? "Full" : `${item.remaining} left`}
                    {suggestedHit ? " · sug" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.primary },
  tabCold: { backgroundColor: "#0284C7" },
  tabText: { fontSize: 11, fontWeight: "800", color: "#6B7280" },
  tabTextActive: { color: "#fff" },
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileFull: { opacity: 0.7 },
  tileCode: { fontSize: 13, fontWeight: "800", color: colors.primary },
  tileCodeActive: { color: "#fff" },
  tileMeta: { marginTop: 2, fontSize: 10, color: colors.textMuted },
});
