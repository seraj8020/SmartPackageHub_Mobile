import { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import { RequestReturnPanel } from "@/features/package-returns/components/RequestReturnPanel";
import { ReturnRequestedConfirm } from "@/features/package-returns/components/ReturnRequestedConfirm";
import { requestPackageReturn } from "@/features/package-returns/services/packageReturnApi";
import { getReturnRequestEligibility } from "@/features/package-returns/utils/residentReturnEligibility";
import { getResidentHistory, type HistoryItem } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import { formatDisplayTimestamp } from "@/shared/utils/formatDisplayTimestamp";

type HistoryFilter = "all" | "thisMonth" | "lastMonth";

const filters: Array<{ id: HistoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
];

function isInFilter(item: HistoryItem, filter: HistoryFilter): boolean {
  if (filter === "all") return true;
  const date = new Date(item.collectedAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const targetMonth = filter === "thisMonth" ? now.getMonth() : (now.getMonth() + 11) % 12;
  const targetYear = filter === "thisMonth" || now.getMonth() > 0 ? now.getFullYear() : now.getFullYear() - 1;
  return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
}

function historyTrackingLine(item: HistoryItem): string | null {
  const tracking = item.trackingNumber?.trim();
  const awb = item.courierAwb?.trim();
  const parts: string[] = [];
  if (tracking) parts.push(`Tracking ${tracking}`);
  if (awb && awb.toLowerCase() !== tracking?.toLowerCase()) parts.push(`AWB ${awb}`);
  else if (awb && !tracking) parts.push(`AWB ${awb}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ResidentHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [submittedReturn, setSubmittedReturn] = useState<HistoryItem | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const session = await getResidentSession();
      if (!session) {
        setItems([]);
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const history = await getResidentHistory(session.residentId);
      setItems(history.sort((a, b) => (Date.parse(b.collectedAt) || 0) - (Date.parse(a.collectedAt) || 0)));
      setError(null);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Unable to load delivery history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const displayedItems = useMemo(
    () => items.filter((item) => isInFilter(item, filter)),
    [filter, items],
  );

  const submitReturn = useCallback(async (item: HistoryItem) => {
    if (!item.packageId) return;
    setRequestingId(item.packageId);
    setError(null);
    try {
      const session = await getResidentSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      await requestPackageReturn(item.packageId, session.residentId, "DamagedInside");
      setItems((current) =>
        current.map((row) =>
          row.packageId === item.packageId
            ? {
                ...row,
                returnStatus: "ReturnRequested",
                status: "ReturnRequested",
                packageStatus: "ReturnRequested",
              }
            : row,
        ),
      );
      setSubmittedReturn(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request return.");
    } finally {
      setRequestingId(null);
    }
  }, []);

  if (submittedReturn) {
    return <ReturnRequestedConfirm onBack={() => setSubmittedReturn(null)} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <Text style={styles.title}>Delivery History</Text>
        <Text style={styles.subtitle}>All packages received via SPH</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.filters}>
          {filters.map((option) => {
            const active = filter === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setFilter(option.id)}
                style={[styles.filter, active && styles.filterActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>
        ) : displayedItems.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={23} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No delivery history yet</Text>
            <Text style={styles.emptyBody}>Collected packages will appear here.</Text>
          </View>
        ) : (
          displayedItems.map((item, index) => {
            const trackingLine = historyTrackingLine(item);
            const eligibility = getReturnRequestEligibility({
              status: item.status,
              packageStatus: item.packageStatus,
              returnStatus: item.returnStatus,
              deliveredAt: item.collectedAt,
              treatBlankAsDelivered: true,
            });
            return (
              <View key={item.id || `${item.pkgNumber ?? "package"}-${index}`} style={styles.card}>
                <View style={[styles.statusIcon, eligibility.alreadyRequested && styles.requestedStatusIcon]}>
                  <Ionicons
                    name={eligibility.alreadyRequested ? "return-up-back-outline" : "checkmark-circle-outline"}
                    size={17}
                    color={eligibility.alreadyRequested ? "#E11D48" : "#10B981"}
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.courier}>{item.courier}</Text>
                  {item.category ? (
                    <Text style={styles.category} numberOfLines={1}>
                      {item.category}
                    </Text>
                  ) : null}
                  {item.pkgNumber ? (
                    <Text style={styles.packageNumber}>Package {item.pkgNumber}</Text>
                  ) : null}
                  {trackingLine ? (
                    <Text style={styles.trackingLine} numberOfLines={2}>
                      {trackingLine}
                    </Text>
                  ) : null}
                  <Text style={styles.deliveryInfo}>
                    {formatDisplayTimestamp(item.collectedAt)}
                    {item.methodOfDelivery || item.method
                      ? ` · ${item.methodOfDelivery || item.method}`
                      : ""}
                  </Text>
                  <RequestReturnPanel
                    compact
                    eligibility={eligibility}
                    busy={requestingId === item.packageId}
                    onRequest={() => void submitReturn(item)}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", letterSpacing: -0.25 },
  subtitle: { marginTop: 5, color: "rgba(255,255,255,0.58)", fontSize: 12 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 13 },
  filter: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 18, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 7 },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: "#6B7280", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF" },
  loader: { marginTop: 28 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 8,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    backgroundColor: colors.surface,
  },
  statusIcon: {
    width: 32,
    height: 32,
    marginTop: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
  },
  cardContent: { flex: 1, minWidth: 0 },
  courier: {
    alignSelf: "flex-start",
    color: "#B45309",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#FEF3C7",
  },
  category: { marginTop: 6, color: "#4B5563", fontSize: 13, fontWeight: "600" },
  packageNumber: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  trackingLine: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  deliveryInfo: { marginTop: 4, color: "#9CA3AF", fontSize: 11 },
  requestedStatusIcon: { backgroundColor: "#FFF1F2" },
  empty: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 30, borderRadius: 13, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: colors.surface },
  emptyTitle: { marginTop: 8, color: "#4B5563", fontSize: 14, fontWeight: "600" },
  emptyBody: { marginTop: 4, color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  error: { borderRadius: 13, borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2", padding: 14 },
  errorText: { color: "#B91C1C", fontSize: 12 },
});
