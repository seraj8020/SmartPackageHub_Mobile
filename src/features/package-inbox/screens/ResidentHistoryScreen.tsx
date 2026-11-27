import { useCallback, useRef, useState } from "react";
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
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import { RequestReturnPanel } from "@/features/package-returns/components/RequestReturnPanel";
import { getReturnRequestEligibility } from "@/features/package-returns/utils/residentReturnEligibility";
import { formatPackageReturnReason } from "@/features/package-returns/utils/returnReasonLabels";
import {
  getResidentHistory,
  type HistoryItem,
  type ResidentHistoryRange,
} from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import { formatDisplayTimestamp } from "@/shared/utils/formatDisplayTimestamp";
import type { ResidentStackParamList } from "@/app/navigation/types";

type HistoryPreset = "all" | "thisMonth" | "lastMonth" | "custom";
type Navigation = NativeStackNavigationProp<ResidentStackParamList, "History">;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const presets: Array<{ id: Exclude<HistoryPreset, "custom">; label: string }> = [
  { id: "all", label: "All" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
];

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function monthRange(offsetMonths: number): ResidentHistoryRange {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  return { fromDate: toDateOnly(first), toDate: toDateOnly(last) };
}

function rangeForPreset(preset: Exclude<HistoryPreset, "custom">): ResidentHistoryRange | undefined {
  if (preset === "all") return undefined;
  return monthRange(preset === "thisMonth" ? 0 : -1);
}

function validateRange(fromDate: string, toDate: string): string | null {
  const from = fromDate.trim();
  const to = toDate.trim();
  if (!from && !to) return null;
  if (!from || !to) return "Enter both From and To dates (YYYY-MM-DD).";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return "Use YYYY-MM-DD for both dates.";
  }
  if (from > to) return "From date cannot be after To date.";
  return null;
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
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<HistoryPreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedRange, setAppliedRange] = useState<ResidentHistoryRange | undefined>();
  const appliedRangeRef = useRef<ResidentHistoryRange | undefined>(undefined);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range?: ResidentHistoryRange, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const session = await getResidentSession();
      if (!session) {
        setItems([]);
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const history = await getResidentHistory(session.residentId, range);
      setItems(history.sort((a, b) => (Date.parse(b.collectedAt) || 0) - (Date.parse(a.collectedAt) || 0)));
      appliedRangeRef.current = range;
      setAppliedRange(range);
      setError(null);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Unable to load delivery history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(appliedRangeRef.current);
    }, [load]),
  );

  function applyPreset(next: Exclude<HistoryPreset, "custom">) {
    const range = rangeForPreset(next);
    setPreset(next);
    setFromDate(range?.fromDate ?? "");
    setToDate(range?.toDate ?? "");
    void load(range);
  }

  function applyCustomRange() {
    const validationError = validateRange(fromDate, toDate);
    if (validationError) {
      setError(validationError);
      return;
    }
    const from = fromDate.trim();
    const to = toDate.trim();
    const range = from && to ? { fromDate: from, toDate: to } : undefined;
    setPreset(range ? "custom" : "all");
    void load(range);
  }

  const rangeHint =
    appliedRange?.fromDate && appliedRange?.toDate
      ? `${appliedRange.fromDate} → ${appliedRange.toDate}`
      : "All dates";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <Text style={styles.title}>Delivery History</Text>
        <Text style={styles.subtitle}>All packages received via SPH</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(appliedRange, true)} />
        }
      >
        <View style={styles.filters}>
          {presets.map((option) => {
            const active = preset === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => applyPreset(option.id)}
                style={[styles.filter, active && styles.filterActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rangeCard}>
          <Text style={styles.rangeTitle}>Date range</Text>
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>From</Text>
              <TextInput
                value={fromDate}
                onChangeText={(value) => {
                  setFromDate(value);
                  setPreset("custom");
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.rangeInput}
              />
            </View>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>To</Text>
              <TextInput
                value={toDate}
                onChangeText={(value) => {
                  setToDate(value);
                  setPreset("custom");
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.rangeInput}
              />
            </View>
          </View>
          <Pressable
            style={styles.searchButton}
            onPress={applyCustomRange}
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={16} color="#fff" />
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
          <Text style={styles.rangeHint}>Showing · {rangeHint}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={23} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No packages in this range</Text>
            <Text style={styles.emptyBody}>Try a wider date range or clear the filter.</Text>
          </View>
        ) : (
          items.map((item, index) => {
            const trackingLine = historyTrackingLine(item);
            const eligibility = getReturnRequestEligibility({
              status: item.status,
              packageStatus: item.packageStatus,
              returnStatus: item.returnStatus,
              deliveredAt: item.collectedAt,
              fromDeliveryHistory: true,
            });
            return (
              <View key={item.id || `${item.pkgNumber ?? "package"}-${index}`} style={styles.card}>
                <View
                  style={[styles.statusIcon, eligibility.alreadyRequested && styles.requestedStatusIcon]}
                >
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
                  {item.isDamaged ? <Text style={styles.damageChip}>Damaged on arrival</Text> : null}
                  <Text style={styles.deliveryInfo}>
                    {formatDisplayTimestamp(item.collectedAt)}
                    {item.methodOfDelivery || item.method
                      ? ` · ${item.methodOfDelivery || item.method}`
                      : ""}
                  </Text>
                  {eligibility.alreadyRequested && item.returnReason ? (
                    <View style={styles.returnSummary}>
                      <Text style={styles.returnReason}>
                        {formatPackageReturnReason(item.returnReason)}
                      </Text>
                      {item.returnNote ? (
                        <Text style={styles.returnNote} numberOfLines={2}>
                          {item.returnNote}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <RequestReturnPanel
                    compact
                    eligibility={eligibility}
                    onRequest={() =>
                      navigation.navigate("ReturnRequest", {
                        packageId: item.packageId,
                        packageLabel: item.pkgNumber || item.trackingNumber || item.courier,
                      })
                    }
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
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filter: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: "#6B7280", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF" },
  rangeCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rangeTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  rangeRow: { flexDirection: "row", gap: 10 },
  rangeField: { flex: 1 },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  rangeInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  searchButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  searchButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rangeHint: { marginTop: 8, color: colors.textMuted, fontSize: 11, textAlign: "center" },
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
  damageChip: {
    alignSelf: "flex-start",
    marginTop: 7,
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 6,
    backgroundColor: "#FFF7ED",
    color: "#B45309",
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  returnSummary: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECDD3",
    backgroundColor: "#FFF1F2",
  },
  returnReason: { color: "#BE123C", fontSize: 12, fontWeight: "700" },
  returnNote: { marginTop: 4, color: "#9F1239", fontSize: 11, lineHeight: 15 },
  requestedStatusIcon: { backgroundColor: "#FFF1F2" },
  empty: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: colors.surface,
  },
  emptyTitle: { marginTop: 8, color: "#4B5563", fontSize: 14, fontWeight: "600" },
  emptyBody: { marginTop: 4, color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  error: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    padding: 14,
  },
  errorText: { color: "#B91C1C", fontSize: 12 },
});
