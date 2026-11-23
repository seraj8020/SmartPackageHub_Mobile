import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import { getStaffSession } from "@/features/authentication/services/sessionStorage";
import type { ShelfInventoryItem } from "@/features/shelf-management/models/shelfInventory.types";
import { fetchShelfInventory } from "@/features/shelf-management/services/shelfInventoryApi";
import {
  heldLabel,
  isHeld24h,
  parseReceivedAt,
} from "@/features/shelf-management/utils/shelfAging";
import {
  aisleFromShelfCode,
  rowFromShelfCode,
  shelfRowChipLabel,
} from "@/features/shelf-management/utils/shelfCapacity";
import {
  packageMatchesSearch,
  shelfMatchesSearch,
  staffShelfBadge,
  type StaffShelfTone,
} from "@/features/shelf-management/utils/staffShelfSearch";
import { getSocieties } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";

type StorageFilter = "all" | "ambient" | "cold";

export function ShelfInventoryScreen() {
  const navigation = useNavigation();
  const [societyName, setSocietyName] = useState("");
  const [items, setItems] = useState<ShelfInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StorageFilter>("all");
  const [row, setRow] = useState("");
  const [aisle, setAisle] = useState("");
  const [showOccupied, setShowOccupied] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const stored = await getStaffSession();
      if (!stored) {
        resetToRoot(navigation, "StaffLogin");
        return;
      }
      try {
        const societies = await getSocieties();
        const match = societies.find((item) => item.id === stored.primarySocietyId);
        setSocietyName(match?.name ?? "");
      } catch {
        setSocietyName("");
      }

      const societyId = stored.primarySocietyId ?? stored.societyIds?.[0];
      if (societyId) {
        const inventory = await fetchShelfInventory(societyId);
        setItems(inventory);
        setSelectedId((current) =>
          current && inventory.some((shelf) => shelf.id === current || shelf.code === current)
            ? current
            : inventory[0]?.id || inventory[0]?.code,
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load shelf inventory.");
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const searching = Boolean(query.trim());

  const baseShelves = useMemo(
    () =>
      items.filter((shelf) => {
        if (filter === "cold" && !shelf.isColdStorage) return false;
        if (filter === "ambient" && shelf.isColdStorage) return false;
        return shelfMatchesSearch(shelf, query);
      }),
    [filter, items, query],
  );

  const rows = useMemo(() => {
    const values = [
      ...new Set(baseShelves.map((shelf) => rowFromShelfCode(shelf.code))),
    ];
    return values.sort((a, b) => a.localeCompare(b));
  }, [baseShelves]);

  useEffect(() => {
    if (searching) return;
    if (rows.length === 0) {
      if (row) setRow("");
      return;
    }
    if (row && rows.includes(row)) return;
    setRow(rows[0]);
  }, [rows, row, searching]);

  const rowShelves = useMemo(() => {
    if (searching || !row) return baseShelves;
    return baseShelves.filter((shelf) => rowFromShelfCode(shelf.code) === row);
  }, [baseShelves, row, searching]);

  const aisles = useMemo(() => {
    const values = [
      ...new Set(
        rowShelves
          .map((shelf) => aisleFromShelfCode(shelf.code))
          .filter((value) => Boolean(value)),
      ),
    ];
    return values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rowShelves]);

  useEffect(() => {
    if (searching) return;
    if (aisles.length === 0) {
      if (aisle) setAisle("");
      return;
    }
    if (aisle && aisles.includes(aisle)) return;
    setAisle(aisles[0]);
  }, [aisles, aisle, searching]);

  const aisleShelves = useMemo(() => {
    if (searching || !aisle || aisles.length === 0) return rowShelves;
    return rowShelves.filter((shelf) => aisleFromShelfCode(shelf.code) === aisle);
  }, [rowShelves, aisle, aisles.length, searching]);

  const visibleShelves = useMemo(() => {
    // While searching, show every match. Otherwise hide occupied unless toggled on.
    const list =
      searching || showOccupied
        ? aisleShelves
        : aisleShelves.filter((shelf) => shelf.packageCount === 0 && !shelf.isFull);
    return [...list].sort((a, b) => {
      const aBusy = a.packageCount > 0 || a.isFull ? 1 : 0;
      const bBusy = b.packageCount > 0 || b.isFull ? 1 : 0;
      if (aBusy !== bBusy) return aBusy - bBusy;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  }, [aisleShelves, searching, showOccupied]);

  useEffect(() => {
    if (
      selectedId &&
      !visibleShelves.some((shelf) => shelf.id === selectedId || shelf.code === selectedId)
    ) {
      setSelectedId(visibleShelves[0]?.id || visibleShelves[0]?.code);
    }
  }, [visibleShelves, selectedId]);

  const selected =
    visibleShelves.find((shelf) => shelf.id === selectedId || shelf.code === selectedId) ??
    visibleShelves[0];

  const openCount = useMemo(
    () => items.reduce((count, shelf) => count + shelf.packageCount, 0),
    [items],
  );

  const freeCount = aisleShelves.filter(
    (shelf) => shelf.packageCount === 0 && !shelf.isFull,
  ).length;
  const occupiedCount = aisleShelves.length - freeCount;

  const detailPackages = useMemo(() => {
    if (!selected) return [];
    const packages = query.trim()
      ? selected.packages.filter((pkg) => packageMatchesSearch(pkg, query))
      : [...selected.packages];
    return packages.sort((a, b) => {
      const aHeld = isHeld24h(a.receivedAt, now) ? 1 : 0;
      const bHeld = isHeld24h(b.receivedAt, now) ? 1 : 0;
      if (aHeld !== bHeld) return bHeld - aHeld;
      return (parseReceivedAt(a.receivedAt) ?? 0) - (parseReceivedAt(b.receivedAt) ?? 0);
    });
  }, [selected, now, query]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Shelf map</Text>
        <Text style={styles.sub}>
          Find a shelf or package
          {societyName ? ` · ${societyName}` : ""}
          {loading ? "" : ` · ${openCount} open`}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search resident, AWB, courier, or shelf"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <View style={styles.filters}>
          {(
            [
              { id: "all", label: "All" },
              { id: "ambient", label: "Ambient" },
              { id: "cold", label: "Cold" },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.filter, active && styles.filterActive]}
                onPress={() => setFilter(item.id)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!loading && !error && !searching && rows.length > 0 ? (
          <View style={styles.chipRow}>
            {rows.map((item) => {
              const active = row === item;
              const label = shelfRowChipLabel(item, baseShelves);
              return (
                <Pressable
                  key={item}
                  onPress={() => setRow(item)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!loading && !error && !searching && aisles.length > 0 ? (
          <View style={styles.chipRow}>
            {aisles.map((item) => {
              const active = aisle === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setAisle(item)}
                  style={[styles.rackChip, active && styles.rackChipActive]}
                >
                  <Text style={[styles.rackChipText, active && styles.chipTextActive]}>
                    Rack {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!loading && !error ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {searching
                ? `${visibleShelves.length} match${visibleShelves.length === 1 ? "" : "es"}`
                : `${freeCount} free · ${occupiedCount} occupied`}
            </Text>
            {!searching ? (
              <Pressable
                onPress={() => setShowOccupied((value) => !value)}
                hitSlop={8}
                style={styles.toggle}
              >
                <Text style={styles.toggleText}>
                  {showOccupied ? "Hide occupied" : "Show occupied"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? <ActivityIndicator style={styles.status} color={colors.primary} /> : null}
        {!loading && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryBtn}>
              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.grid}>
              {visibleShelves.map((shelf) => {
                const active =
                  selected != null &&
                  (shelf.id === selected.id || shelf.code === selected.code);
                const badge = staffShelfBadge(shelf, now);
                return (
                  <View key={shelf.id || shelf.code} style={styles.shelf}>
                    <Pressable
                      style={[
                        styles.shelfInner,
                        shelfToneStyle(badge.tone),
                        active && styles.shelfSelected,
                      ]}
                      onPress={() => setSelectedId(shelf.id || shelf.code)}
                    >
                      <Text
                        style={[
                          styles.shelfCode,
                          (badge.tone === "full" || badge.tone === "occupied") &&
                            styles.shelfCodeBusy,
                          badge.tone === "empty" && styles.shelfCodeFree,
                        ]}
                        numberOfLines={1}
                      >
                        {shelf.code}
                      </Text>
                      <Text
                        style={[
                          styles.shelfBadge,
                          (badge.tone === "full" || badge.tone === "occupied") &&
                            styles.shelfBadgeBusy,
                          badge.tone === "empty" && styles.shelfBadgeFree,
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {visibleShelves.length === 0 ? (
              <Text style={styles.empty}>
                {query.trim()
                  ? "No shelves match that search."
                  : showOccupied
                    ? "No shelves match this filter."
                    : "No free slots here. Show occupied, or pick another rack."}
              </Text>
            ) : null}

            {selected ? (
              <View style={styles.detailSection}>
                {detailPackages.length === 0 ? (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{selected.code}</Text>
                    <Text style={styles.detailEmpty}>
                      {query.trim()
                        ? "No packages on this shelf match the search."
                        : selected.packageCount === 0
                          ? "Slot is free — ready for intake."
                          : "No shelved packages on this shelf."}
                    </Text>
                  </View>
                ) : (
                  detailPackages.map((pkg) => {
                    const held = isHeld24h(pkg.receivedAt, now);
                    return (
                      <View key={pkg.id || pkg.packageNumber} style={styles.detailCard}>
                        <Text style={styles.detailTitle} numberOfLines={1}>
                          {selected.code} · {pkg.residentName}
                        </Text>
                        <View style={styles.detailMetaRow}>
                          <Text style={styles.detailMeta} numberOfLines={1}>
                            {pkg.packageNumber} · {pkg.courier}
                          </Text>
                          {held ? (
                            <Text style={styles.heldBadge}>
                              Held {heldLabel(pkg.receivedAt, now)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function shelfToneStyle(tone: StaffShelfTone): {
  backgroundColor: string;
  borderColor: string;
} {
  switch (tone) {
    case "empty":
      return { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" };
    case "full":
      return { backgroundColor: "#FEF2F2", borderColor: "#FECACA" };
    case "occupied":
      return { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" };
    case "cold":
      return { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" };
    case "coldHold":
      return { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" };
    default:
      return { backgroundColor: "#FFFFFF", borderColor: "#F3F4F6" };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { color: "white", fontSize: 16, fontWeight: "700" },
  sub: { color: "rgba(255,255,255,.55)", fontSize: 12, marginTop: 4 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 12, paddingVertical: 0 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: "#6B7280", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "white" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 10, fontWeight: "800", color: "#6B7280" },
  chipTextActive: { color: "#fff" },
  rackChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  rackChipActive: { backgroundColor: "#4338CA" },
  rackChipText: { fontSize: 11, fontWeight: "800", color: "#4338CA" },
  summaryRow: {
    marginBottom: 10,
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
  status: { marginTop: 24 },
  errorBox: {
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginBottom: 12,
  },
  error: { color: "#DC2626", fontSize: 14 },
  retryBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  retryText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  empty: { color: "#9CA3AF", textAlign: "center", paddingVertical: 28, fontSize: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  shelf: {
    width: "25%",
    paddingHorizontal: 4,
    paddingVertical: 4,
    minHeight: 76,
  },
  shelfInner: {
    flex: 1,
    minHeight: 68,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    justifyContent: "space-between",
  },
  shelfSelected: {
    borderWidth: 2,
    borderColor: "rgba(28, 61, 90, 0.45)",
  },
  shelfCode: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  shelfCodeFree: { color: "#065F46" },
  shelfCodeBusy: { color: "#991B1B" },
  shelfBadge: { color: "#6B7280", fontSize: 11, fontWeight: "600", marginTop: 4, opacity: 0.9 },
  shelfBadgeFree: { color: "#047857" },
  shelfBadgeBusy: { color: "#B91C1C" },
  detailSection: { marginTop: 16, gap: 8 },
  detailCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailTitle: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  detailEmpty: { color: "#9CA3AF", fontSize: 12, marginTop: 4 },
  detailMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  detailMeta: { flex: 1, color: "#6B7280", fontSize: 11 },
  heldBadge: { color: "#E11D48", fontSize: 11, fontWeight: "700" },
});
