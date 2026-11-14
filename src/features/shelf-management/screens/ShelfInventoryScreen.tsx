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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import type { ShelfInventoryItem } from "@/features/shelf-management/models/shelfInventory.types";
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
import { getSocieties } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";
import { SignOutButton } from "@/shared/ui/SignOutButton";

type StorageFilter = "all" | "cold";

export function ShelfInventoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Loading society…");
  const [items, setItems] = useState<ShelfInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StorageFilter>("all");
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
      setSession(stored);
      try {
        const societies = await getSocieties();
        const match = societies.find((item) => item.id === stored.primarySocietyId);
        setSocietyName(
          match?.name ??
            (stored.primarySocietyId
              ? `Society ${stored.primarySocietyId.slice(0, 8)}…`
              : "Society"),
        );
      } catch {
        setSocietyName("Society");
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

  const visibleShelves = useMemo(
    () =>
      items.filter(
        (shelf) =>
          (filter === "all" || shelf.isColdStorage) && shelfMatchesSearch(shelf, query),
      ),
    [filter, items, query],
  );

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

  const username = session?.username ?? "Staff";
  const sideInset = Math.max(insets.left, insets.right, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingLeft: 12 + sideInset,
            paddingRight: 12 + sideInset,
          },
        ]}
      >
        <View style={styles.topBarText}>
          <Text style={styles.society} numberOfLines={1}>
            {societyName}
          </Text>
          <Text style={styles.user} numberOfLines={1}>
            {username}
          </Text>
        </View>
        <SignOutButton
          onPress={() => {
            void (async () => {
              await clearStaffSession();
              await tokenStorage.removeToken();
              resetToRoot(navigation, "Launch");
            })();
          }}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Shelf map</Text>
        <Text style={styles.sub}>
          Find a shelf or package
          {societyName && societyName !== "Loading society…" ? ` · ${societyName}` : ""}
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
                      <Text style={styles.shelfCode} numberOfLines={1}>
                        {shelf.code}
                      </Text>
                      <Text style={styles.shelfBadge}>{badge.label}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {visibleShelves.length === 0 ? (
              <Text style={styles.empty}>
                {query.trim()
                  ? "No shelves match that search."
                  : "No shelves match this filter."}
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

function shelfToneStyle(
  tone: "empty" | "full" | "coldHold" | "cold" | "count",
): { backgroundColor: string; borderColor: string } {
  switch (tone) {
    case "empty":
      return { backgroundColor: "#FFFFFF", borderColor: "#F3F4F6" };
    case "full":
      return { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" };
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
  topBar: {
    backgroundColor: colors.primary,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  topBarText: { flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 8 },
  society: { color: "#fff", fontSize: 12, fontWeight: "700" },
  user: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
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
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
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
    borderColor: "rgba(28, 61, 90, 0.35)",
  },
  shelfCode: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  shelfBadge: { color: "#6B7280", fontSize: 11, fontWeight: "600", marginTop: 4, opacity: 0.9 },
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
