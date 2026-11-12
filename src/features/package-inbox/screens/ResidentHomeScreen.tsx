import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { ResidentSessionState } from "@/features/authentication/models/auth.types";
import {
  clearResidentSession,
  getResidentSession,
} from "@/features/authentication/services/sessionStorage";
import { CodApprovalDialog } from "@/features/package-inbox/components/CodApprovalDialog";
import {
  getResidentPackages,
  getSocieties,
  type HubPackage,
} from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";
import {
  firstNameFrom,
  greetingForNow,
  societyLocationLabel,
} from "@/shared/utils/greeting";

export function ResidentHomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ResidentSessionState | null>(null);
  const [societyName, setSocietyName] = useState("");
  const [packages, setPackages] = useState<HubPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedCodIds, setDismissedCodIds] = useState<Set<string>>(new Set());

  const inboxPackages = useMemo(
    () =>
      packages
        .filter((pkg) => (pkg.status ?? "Shelved") === "Shelved")
        .slice()
        .sort((a, b) => (Date.parse(b.receivedAt) || 0) - (Date.parse(a.receivedAt) || 0)),
    [packages],
  );

  const pendingCod = useMemo(
    () =>
      packages.find(
        (pkg) =>
          pkg.isCod &&
          pkg.codApprovalStatus === "Pending" &&
          (pkg.status ?? "Received") === "Received" &&
          !dismissedCodIds.has(pkg.id),
      ) ?? null,
    [packages, dismissedCodIds],
  );

  const pendingCodCount = packages.filter(
    (pkg) =>
      pkg.isCod &&
      pkg.codApprovalStatus === "Pending" &&
      (pkg.status ?? "Received") === "Received",
  ).length;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const stored = await getResidentSession();
        if (!stored) {
          resetToRoot(navigation, "ResidentLogin");
          return;
        }
        setSession(stored);
        const [societies, pkgs] = await Promise.all([
          getSocieties().catch(() => []),
          getResidentPackages(stored.residentId),
        ]);
        const match = societies.find((item) => item.id === stored.societyId);
        setSocietyName(match?.name ?? "");
        setPackages(pkgs);
      } catch {
        setPackages([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (pendingCodCount === 0) return;
    const timer = setInterval(() => {
      void load(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [pendingCodCount, load]);

  async function signOut() {
    await clearResidentSession();
    await tokenStorage.removeToken();
    resetToRoot(navigation, "Launch");
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {pendingCod ? (
        <CodApprovalDialog
          pkg={pendingCod}
          onResolved={() => {
            setDismissedCodIds((prev) => new Set([...prev, pendingCod.id]));
            void load(true);
          }}
          onDismiss={() => {
            setDismissedCodIds((prev) => new Set([...prev, pendingCod.id]));
          }}
        />
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.location} numberOfLines={1}>
            {societyLocationLabel(societyName, session?.towerWing, session?.flatNumber)}
          </Text>
          <View style={styles.heroActions}>
            <Pressable onPress={() => void signOut()} hitSlop={8}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => {
                const next = packages.find(
                  (pkg) => pkg.isCod && pkg.codApprovalStatus === "Pending",
                );
                if (!next) return;
                setDismissedCodIds((prev) => {
                  const copy = new Set(prev);
                  copy.delete(next.id);
                  return copy;
                });
              }}
              style={styles.bell}
            >
              <Ionicons name="notifications-outline" size={16} color="rgba(255,255,255,0.75)" />
              {pendingCodCount > 0 ? <View style={styles.bellDot} /> : null}
            </Pressable>
          </View>
        </View>
        <Text style={styles.greeting}>
          {greetingForNow()}, {firstNameFrom(session?.fullName)}!
        </Text>
        <View style={styles.statCard}>
          <View>
            <Text style={styles.statLabel}>Awaiting pickup</Text>
            <Text style={styles.statValue}>
              {loading ? "…" : `${inboxPackages.length} packages`}
            </Text>
          </View>
          <Ionicons name="cube-outline" size={30} color="rgba(255,255,255,0.25)" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <Text style={styles.sectionTitle}>Shelved at the Hub</Text>
        <Text style={styles.sectionHint}>
          Only shelved packages appear here · door slot booking comes next
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : inboxPackages.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={22} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No shelved packages yet</Text>
            <Text style={styles.emptyBody}>
              Packages show here after hub staff assigns a shelf.
            </Text>
          </View>
        ) : (
          inboxPackages.map((pkg) => (
            <View key={pkg.id} style={styles.packageCard}>
              <View style={styles.packageTop}>
                <Text style={styles.courier}>{pkg.courier ?? "Courier"}</Text>
                <Text style={styles.shelf}>{pkg.shelfCode ?? "—"}</Text>
              </View>
              <Text style={styles.tracking}>
                {pkg.tracking || pkg.trackingNumber || pkg.recipientName || "Package"}
              </Text>
              {pkg.pkgNumber ? <Text style={styles.pkgNumber}>{pkg.pkgNumber}</Text> : null}
              {pkg.isCod ? (
                <Text style={styles.codChip}>
                  COD
                  {pkg.codAmount != null ? ` ₹${pkg.codAmount}` : ""}
                  {pkg.codApprovalStatus ? ` · ${pkg.codApprovalStatus}` : ""}
                </Text>
              ) : null}
              <Text style={styles.received}>
                Received {new Date(pkg.receivedAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  location: { flex: 1, color: "rgba(255,255,255,0.5)", fontSize: 11 },
  signOut: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "600" },
  bell: { position: "relative", padding: 4 },
  bellDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F87171",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  greeting: {
    marginTop: 4,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  statCard: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionHint: { fontSize: 11, color: "#9CA3AF", marginBottom: 12 },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyTitle: { marginTop: 8, fontSize: 14, fontWeight: "600", color: "#4B5563" },
  emptyBody: { marginTop: 4, fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  packageCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 14,
    marginBottom: 8,
  },
  packageTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  courier: { fontSize: 11, fontWeight: "700", color: colors.primary },
  shelf: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },
  tracking: { fontSize: 14, fontWeight: "600", color: colors.text },
  pkgNumber: { marginTop: 2, fontSize: 10, color: "#9CA3AF" },
  codChip: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  received: { marginTop: 6, fontSize: 11, color: colors.textMuted },
});
