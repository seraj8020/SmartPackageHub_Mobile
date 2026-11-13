import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import { clearStaffSession, getStaffSession } from "@/features/authentication/services/sessionStorage";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import { getSocieties, getSocietyPackages, startTowerRoute, type HubPackage } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import { SignOutButton } from "@/shared/ui/SignOutButton";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { formatUnitLabel } from "@/shared/utils/formatUnitLabel";

interface RunnerRouteScreenProps {
  societyId?: string;
  runnerName?: string;
}

function packageFloor(pkg: HubPackage): number | null {
  if (typeof pkg.floor === "number" && Number.isFinite(pkg.floor)) return pkg.floor;
  const match = (pkg.flat || pkg.flatNumber || "").trim().match(/^(\d{1,2})\d{2,}$/);
  return match ? Number(match[1]) : null;
}

function compareFlat(a: HubPackage, b: HubPackage): number {
  const aFloor = packageFloor(a);
  const bFloor = packageFloor(b);
  if (aFloor !== null && bFloor !== null && aFloor !== bFloor) return aFloor - bFloor;
  return (a.flat || a.flatNumber || "").localeCompare(
    b.flat || b.flatNumber || "",
    undefined,
    { numeric: true, sensitivity: "base" },
  );
}

export function RunnerRouteScreen({ societyId: societyIdProp, runnerName: runnerNameProp }: RunnerRouteScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Society");
  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      const stored = await getStaffSession();
      if (!active) return;
      if (!stored) {
        resetToRoot(navigation, "StaffLogin");
        return;
      }
      setSession(stored);
      try {
        const societies = await getSocieties();
        const match = societies.find((item) => item.id === (stored.primarySocietyId ?? stored.societyIds[0]));
        if (active) setSocietyName(match?.name ?? "Society");
      } catch {
        if (active) setSocietyName("Society");
      }
    })();
    return () => { active = false; };
  }, [navigation]));
  const societyId = societyIdProp ?? session?.primarySocietyId ?? session?.societyIds?.[0] ?? "";
  const runnerName = runnerNameProp ?? session?.username ?? "Staff";
  const [packages, setPackages] = useState<HubPackage[]>([]);
  const [selectedTower, setSelectedTower] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!societyId) {
      setPackages([]);
      setLoadError("Society session is missing. Sign in again.");
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setLoadError(null);
    getSocietyPackages(societyId)
      .then((rows) => { if (active) setPackages(rows); })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load shelved packages.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [societyId, reloadKey]);

  const eligible = useMemo(
    () => packages.filter((pkg) => pkg.status?.trim().toLowerCase() === "shelved" && Boolean((pkg.tower || pkg.towerWing)?.trim())),
    [packages],
  );
  const towers = useMemo(
    () => Array.from(new Set(eligible.map((pkg) => (pkg.tower || pkg.towerWing || "").trim()))).sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    ),
    [eligible],
  );

  useEffect(() => {
    if (!towers.includes(selectedTower)) {
      setSelectedTower(towers[0] ?? "");
      setSelectedFloor("all");
    }
  }, [towers, selectedTower]);

  const towerPackages = useMemo(
    () => eligible.filter((pkg) => (pkg.tower || pkg.towerWing || "").trim() === selectedTower).sort(compareFlat),
    [eligible, selectedTower],
  );
  const floors = useMemo(
    () => Array.from(new Set(towerPackages.map(packageFloor).filter((floor): floor is number => floor !== null))).sort((a, b) => a - b),
    [towerPackages],
  );
  const filtered = selectedFloor === "all" ? towerPackages : towerPackages.filter((pkg) => packageFloor(pkg) === selectedFloor);

  async function handleStartRoute() {
    if (!selectedTower || filtered.length === 0 || starting) return;
    setStarting(true);
    setStartError(null);
    setSuccess(null);
    try {
      const result = await startTowerRoute(societyId, selectedTower, selectedFloor === "all" ? null : selectedFloor);
      setSuccess(`${result.dispatchedCount} packages dispatched for Tower ${selectedTower}.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Unable to start route.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={styles.topBarText}>
          <Text style={styles.society} numberOfLines={1}>{societyName}</Text>
          <Text style={styles.user} numberOfLines={1}>{runnerName}</Text>
        </View>
        <SignOutButton onPress={() => void (async () => {
          await clearStaffSession();
          await tokenStorage.removeToken();
          resetToRoot(navigation, "Launch");
        })()} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Runner batch</Text>
        <Text style={styles.subtitle}>Group shelved packages by tower and floor, then start the route for handover.</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          setReloadKey((key) => key + 1);
          setTimeout(() => setRefreshing(false), 600);
        }} />}
      >
        <View style={styles.runnerCard}>
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.runnerText}>Runner: {runnerName}</Text>
          <Text style={styles.runnerCount}>{eligible.length} on shelf</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : loadError ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable onPress={() => setReloadKey((key) => key + 1)} style={styles.retry}>
              <Ionicons name="refresh" size={15} color={colors.primary} /><Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : towers.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={26} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No route batches available</Text>
            <Text style={styles.emptyText}>Shelved packages with a tower assignment will appear here.</Text>
          </View>
        ) : <>
          <Text style={styles.sectionLabel}>SELECT TOWER</Text>
          <View style={styles.chips}>
            {towers.map((tower) => <ChoiceChip key={tower} label={`Tower ${tower}`} selected={tower === selectedTower} onPress={() => {
              setSelectedTower(tower); setSelectedFloor("all"); setStartError(null); setSuccess(null);
            }} />)}
          </View>

          <Text style={styles.sectionLabel}>SELECT FLOOR</Text>
          <View style={styles.chips}>
            <ChoiceChip label="All floors" selected={selectedFloor === "all"} onPress={() => { setSelectedFloor("all"); setStartError(null); }} />
            {floors.map((floor) => <ChoiceChip key={floor} label={`Floor ${floor}`} selected={selectedFloor === floor} onPress={() => { setSelectedFloor(floor); setStartError(null); }} />)}
          </View>

          <View style={styles.batchCard}>
            <View style={styles.batchHeader}>
              <Text style={styles.batchTitle}>Tower {selectedTower} batch</Text>
              <Text style={styles.batchMeta}>{filtered.length} packages · {selectedFloor === "all" ? "All floors" : `Floor ${selectedFloor}`}</Text>
            </View>
            {filtered.length ? filtered.map((pkg, index) => (
              <View style={styles.packageRow} key={pkg.id}>
                <View style={styles.order}><Text style={styles.orderText}>{index + 1}</Text></View>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageTitle}>{formatUnitLabel(pkg.tower || pkg.towerWing, pkg.flat || pkg.flatNumber)}</Text>
                  <Text style={styles.packageDetail} numberOfLines={1}>{pkg.recipientName || "Resident unknown"} · {pkg.pkgNumber || pkg.tracking || "PKG"}</Text>
                </View>
                <Ionicons name="cube-outline" size={17} color="#9CA3AF" />
              </View>
            )) : <Text style={styles.noPackages}>No shelved packages on this floor.</Text>}
          </View>

          {startError ? <Text style={styles.errorBox}>{startError}</Text> : null}
          {success ? <Text style={styles.successBox}>{success}</Text> : null}
          <Pressable style={[styles.startButton, (starting || filtered.length === 0) && styles.disabled]} disabled={starting || filtered.length === 0} onPress={() => void handleStartRoute()}>
            {starting ? <ActivityIndicator color="#fff" /> : <Ionicons name="navigate-outline" size={18} color="#fff" />}
            <Text style={styles.startText}>{starting ? "Starting route…" : "Start route"}</Text>
          </Pressable>
          <Text style={styles.note}>Starting the route dispatches this batch (Shelved → Dispatched).</Text>
        </>}
      </ScrollView>
    </View>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.selectedChip]}><Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  topBarText: { flex: 1, minWidth: 0, paddingRight: 8 },
  society: { color: "#fff", fontSize: 12, fontWeight: "700" },
  user: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
  header: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  title: { color: "#fff", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  content: { padding: 16, paddingBottom: 30 },
  runnerCard: { backgroundColor: "#EAF0F5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 20 },
  runnerText: { color: colors.primary, fontWeight: "700", fontSize: 12, flex: 1 },
  runnerCount: { color: "#6B7280", fontSize: 11 },
  sectionLabel: { color: colors.primary, fontSize: 10, letterSpacing: 1, fontWeight: "800", marginBottom: 9, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.1)", borderWidth: 1, borderRadius: 18 },
  selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, color: "#4B5563", fontWeight: "700" },
  selectedChipText: { color: "#fff" },
  batchCard: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 14 },
  batchHeader: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 13 },
  batchTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  batchMeta: { color: "rgba(255,255,255,0.68)", fontSize: 10, marginTop: 4 },
  packageRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB", gap: 10 },
  order: { width: 25, height: 25, borderRadius: 13, backgroundColor: "#EAF0F5", alignItems: "center", justifyContent: "center" },
  orderText: { fontSize: 11, color: colors.primary, fontWeight: "800" },
  packageInfo: { flex: 1 },
  packageTitle: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  packageDetail: { color: "#6B7280", fontSize: 10, marginTop: 3 },
  noPackages: { color: "#6B7280", fontSize: 12, padding: 14 },
  startButton: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, marginTop: 2 },
  startText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  note: { color: "#9CA3AF", fontSize: 10, lineHeight: 15, marginTop: 9, textAlign: "center" },
  empty: { alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 24, gap: 8 },
  emptyTitle: { color: "#4B5563", fontSize: 14, fontWeight: "700" },
  emptyText: { color: "#9CA3AF", fontSize: 12, lineHeight: 18, textAlign: "center" },
  messageCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  errorText: { color: colors.danger, fontSize: 12 },
  retry: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  retryText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  errorBox: { color: colors.danger, fontSize: 12, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 11, marginBottom: 10 },
  successBox: { color: "#047857", fontSize: 12, backgroundColor: "#ECFDF5", borderRadius: 10, padding: 11, marginBottom: 10 },
});
