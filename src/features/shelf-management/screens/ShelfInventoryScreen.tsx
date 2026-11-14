import { useCallback, useMemo, useState } from "react";
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
import type { ShelfInventoryItem, ShelfPackage } from "@/features/shelf-management/models/shelfInventory.types";
import { fetchShelfInventory } from "@/features/shelf-management/services/shelfInventoryApi";
import { colors } from "@/shared/theme/colors";

type StorageFilter = "all" | "cold";

function matchesQuery(shelf: ShelfInventoryItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [shelf.code, ...shelf.packages.flatMap((pkg) => [pkg.residentName, pkg.packageNumber, pkg.courier])]
    .some((value) => value.toLowerCase().includes(needle));
}

function PackageRow({ pkg }: { pkg: ShelfPackage }) {
  return (
    <View style={styles.packageRow}>
      <View style={styles.packageIcon}><Ionicons name="cube-outline" size={16} color={colors.primary} /></View>
      <View style={styles.packageText}>
        <Text style={styles.residentName} numberOfLines={1}>{pkg.residentName}</Text>
        <Text style={styles.packageMeta} numberOfLines={1}>{pkg.packageNumber} · {pkg.courier}</Text>
      </View>
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

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const session = await getStaffSession();
      if (session?.primarySocietyId) setItems(await fetchShelfInventory(session.primarySocietyId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load shelf inventory.");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleShelves = useMemo(() => items.filter((shelf) =>
    (filter === "all" || shelf.isColdStorage) && matchesQuery(shelf, query),
  ), [filter, items, query]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Shelf map</Text>
        <Text style={styles.sub}>Find a shelf or package</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search resident, AWB, courier, or shelf" placeholderTextColor="#94A3B8" style={styles.searchInput} returnKeyType="search" />
        </View>
        <View style={styles.filters}>
          <Pressable style={[styles.filter, filter === "all" && styles.filterActive]} onPress={() => setFilter("all")}><Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>All</Text></Pressable>
          <Pressable style={[styles.filter, filter === "cold" && styles.filterActive]} onPress={() => setFilter("cold")}><Ionicons name="snow-outline" size={14} color={filter === "cold" ? "white" : colors.primary} /><Text style={[styles.filterText, filter === "cold" && styles.filterTextActive]}>Cold</Text></Pressable>
        </View>
        {loading ? <ActivityIndicator style={styles.status} color={colors.primary} /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && visibleShelves.length === 0 ? <Text style={styles.empty}>{query || filter === "cold" ? "No matching shelves or packages." : "No shelves have been configured for this society."}</Text> : null}
        <View style={styles.grid}>
          {!loading && !error ? visibleShelves.map((shelf) => {
            const expanded = expandedCode === shelf.code;
            return <View key={shelf.id || shelf.code} style={[styles.shelfWrap, expanded && styles.shelfWrapExpanded]}>
              <Pressable style={[styles.shelf, expanded && styles.shelfSelected]} onPress={() => setExpandedCode(expanded ? null : shelf.code)}>
                <View style={styles.shelfHeading}><Text style={styles.shelfCode} numberOfLines={1}>{shelf.code}</Text>{shelf.isColdStorage ? <Ionicons name="snow-outline" size={14} color="#0284C7" /> : null}</View>
                <Text style={styles.shelfCount}>{shelf.packageCount ? `${shelf.packageCount} package${shelf.packageCount === 1 ? "" : "s"}` : "Empty"}</Text>
              </Pressable>
              {expanded ? <View style={styles.dropdown}>{shelf.packages.length ? shelf.packages.map((pkg) => <PackageRow key={pkg.id || pkg.packageNumber} pkg={pkg} />) : <Text style={styles.dropdownEmpty}>This shelf is empty.</Text>}</View> : null}
            </View>;
          }) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, header: { backgroundColor: colors.primary, padding: 20 }, title: { color: "white", fontSize: 17, fontWeight: "800" }, sub: { color: "rgba(255,255,255,.65)", fontSize: 12, marginTop: 4 }, content: { padding: 16, paddingBottom: 40 }, searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 22, paddingHorizontal: 14, height: 44 }, searchInput: { flex: 1, color: colors.text, fontSize: 13 }, filters: { flexDirection: "row", gap: 8, marginVertical: 16 }, filter: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#D9E0E8", backgroundColor: colors.surface }, filterActive: { borderColor: colors.primary, backgroundColor: colors.primary }, filterText: { color: colors.primary, fontSize: 12, fontWeight: "800" }, filterTextActive: { color: "white" }, status: { marginTop: 24 }, error: { color: colors.danger, padding: 12, backgroundColor: "#FEF2F2", borderRadius: 10 }, empty: { color: colors.textMuted, textAlign: "center", padding: 24 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, shelfWrap: { width: "47%" }, shelfWrapExpanded: { width: "100%" }, shelf: { minHeight: 84, backgroundColor: colors.surface, borderRadius: 16, padding: 12, justifyContent: "space-between" }, shelfSelected: { borderWidth: 2, borderColor: "#AAB7C5" }, shelfHeading: { flexDirection: "row", justifyContent: "space-between", gap: 4 }, shelfCode: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: "800" }, shelfCount: { color: "#94A3B8", fontSize: 12, marginTop: 10 }, dropdown: { marginTop: 8, borderRadius: 14, backgroundColor: colors.surface, padding: 8 }, packageRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderBottomWidth: 1, borderBottomColor: "#EEF2F7" }, packageIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E0F2FE" }, packageText: { flex: 1 }, residentName: { color: colors.primary, fontWeight: "800", fontSize: 13 }, packageMeta: { color: colors.textMuted, marginTop: 2, fontSize: 11 }, dropdownEmpty: { color: colors.textMuted, fontSize: 12, padding: 8 },
});
