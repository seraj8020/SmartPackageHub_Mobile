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
import { useFocusEffect } from "@react-navigation/native";
import { getStaffSession } from "@/features/authentication/services/sessionStorage";
import type {
  ShelfInventoryItem,
  ShelfPackage,
} from "@/features/shelf-management/models/shelfInventory.types";
import { fetchShelfInventory } from "@/features/shelf-management/services/shelfInventoryApi";
import {
  heldLabel,
  isHeld24h,
  parseReceivedAt,
} from "@/features/shelf-management/utils/shelfAging";
import {
  packageMatchesSearch,
  shelfMatchesSearch,
  staffShelfBadge,
} from "@/features/shelf-management/utils/staffShelfSearch";
import { colors } from "@/shared/theme/colors";

type StorageFilter = "all" | "cold";

function PackageRow({ pkg, now }: { pkg: ShelfPackage; now: number }) {
  const held = isHeld24h(pkg.receivedAt, now);
  return (
    <View style={styles.packageRow}>
      <View style={styles.packageIcon}>
        <Ionicons name="cube-outline" size={16} color={colors.primary} />
      </View>
      <View style={styles.packageText}>
        <Text style={styles.residentName} numberOfLines={1}>
          {pkg.residentName}
        </Text>
        <Text style={styles.packageMeta} numberOfLines={1}>
          {pkg.packageNumber} · {pkg.courier}
        </Text>
      </View>
      {held ? (
        <Text style={styles.heldBadge}>Held {heldLabel(pkg.receivedAt, now)}</Text>
      ) : null}
    </View>
  );
}

export function ShelfInventoryScreen() {
  const [items, setItems] = useState<ShelfInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StorageFilter>("all");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getStaffSession();
      if (session?.primarySocietyId) {
        setItems(await fetchShelfInventory(session.primarySocietyId));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load shelf inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleShelves = useMemo(
    () =>
      items.filter(
        (shelf) =>
          (filter === "all" || shelf.isColdStorage) && shelfMatchesSearch(shelf, query),
      ),
    [filter, items, query],
  );

  const openCount = useMemo(
    () => items.reduce((count, shelf) => count + shelf.packageCount, 0),
    [items],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Shelf map</Text>
        <Text style={styles.sub}>
          Find a shelf or package
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
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
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
          <Pressable
            style={[styles.filter, filter === "all" && styles.filterActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filter, filter === "cold" && styles.filterActive]}
            onPress={() => setFilter("cold")}
          >
            <Ionicons
              name="snow-outline"
              size={14}
              color={filter === "cold" ? "white" : colors.primary}
            />
            <Text style={[styles.filterText, filter === "cold" && styles.filterTextActive]}>
              Cold
            </Text>
          </Pressable>
        </View>

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
        {!loading && !error && visibleShelves.length === 0 ? (
          <Text style={styles.empty}>
            {query || filter === "cold"
              ? "No matching shelves or packages."
              : "No shelves have been configured for this society."}
          </Text>
        ) : null}

        <View style={styles.grid}>
          {!loading && !error
            ? visibleShelves.map((shelf) => {
                const expanded = expandedCode === shelf.code;
                const badge = staffShelfBadge(shelf, now);
                const detailPackages = (
                  query.trim()
                    ? shelf.packages.filter((pkg) => packageMatchesSearch(pkg, query))
                    : [...shelf.packages]
                ).sort((a, b) => {
                  const aHeld = isHeld24h(a.receivedAt, now) ? 1 : 0;
                  const bHeld = isHeld24h(b.receivedAt, now) ? 1 : 0;
                  if (aHeld !== bHeld) return bHeld - aHeld;
                  return (parseReceivedAt(a.receivedAt) ?? 0) - (parseReceivedAt(b.receivedAt) ?? 0);
                });

                return (
                  <View
                    key={shelf.id || shelf.code}
                    style={[styles.shelfWrap, expanded && styles.shelfWrapExpanded]}
                  >
                    <Pressable
                      style={[
                        styles.shelf,
                        shelfToneStyle(badge.tone),
                        expanded && styles.shelfSelected,
                      ]}
                      onPress={() => setExpandedCode(expanded ? null : shelf.code)}
                    >
                      <View style={styles.shelfHeading}>
                        <Text style={styles.shelfCode} numberOfLines={1}>
                          {shelf.code}
                        </Text>
                        {shelf.isColdStorage ? (
                          <Ionicons name="snow-outline" size={14} color="#0284C7" />
                        ) : null}
                      </View>
                      <Text style={styles.shelfCount}>{badge.label}</Text>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.dropdown}>
                        {detailPackages.length ? (
                          detailPackages.map((pkg) => (
                            <PackageRow
                              key={pkg.id || pkg.packageNumber}
                              pkg={pkg}
                              now={now}
                            />
                          ))
                        ) : (
                          <Text style={styles.dropdownEmpty}>
                            {query.trim()
                              ? "No packages on this shelf match the search."
                              : "This shelf is empty."}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
      </ScrollView>
    </View>
  );
}

function shelfToneStyle(
  tone: "empty" | "full" | "coldHold" | "cold" | "count",
): { backgroundColor: string; borderColor: string } {
  switch (tone) {
    case "empty":
      return { backgroundColor: colors.surface, borderColor: "#E5E7EB" };
    case "full":
      return { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" };
    case "cold":
      return { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" };
    case "coldHold":
      return { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" };
    default:
      return { backgroundColor: colors.surface, borderColor: "#E5E7EB" };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, padding: 20 },
  title: { color: "white", fontSize: 17, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,.65)", fontSize: 12, marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  filters: { flexDirection: "row", gap: 8, marginVertical: 16 },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9E0E8",
    backgroundColor: colors.surface,
  },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: "white" },
  status: { marginTop: 24 },
  errorBox: {
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    marginBottom: 12,
  },
  error: { color: colors.danger },
  retryBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  retryText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  empty: { color: colors.textMuted, textAlign: "center", padding: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shelfWrap: { width: "47%" },
  shelfWrapExpanded: { width: "100%" },
  shelf: {
    minHeight: 84,
    borderRadius: 16,
    padding: 12,
    justifyContent: "space-between",
    borderWidth: 1,
  },
  shelfSelected: { borderWidth: 2, borderColor: "#AAB7C5" },
  shelfHeading: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  shelfCode: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: "800" },
  shelfCount: { color: "#64748B", fontSize: 12, marginTop: 10, fontWeight: "700" },
  dropdown: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 8,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  packageIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
  },
  packageText: { flex: 1 },
  residentName: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  packageMeta: { color: colors.textMuted, marginTop: 2, fontSize: 11 },
  heldBadge: { color: "#E11D48", fontSize: 10, fontWeight: "800" },
  dropdownEmpty: { color: colors.textMuted, fontSize: 12, padding: 8 },
});
