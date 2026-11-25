import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { ResidentStackParamList } from "@/app/navigation/types";
import type { ResidentSessionState } from "@/features/authentication/models/auth.types";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import { CodApprovalDialog } from "@/features/package-inbox/components/CodApprovalDialog";
import { InboxPackageCard } from "@/features/package-inbox/components/InboxPackageCard";
import {
  getCachedResidentPackages,
  isResidentPackagesCacheFresh,
  setCachedResidentPackages,
} from "@/features/package-inbox/services/residentPackageCache";
import {
  arrivalPhotoRequestHeaders,
  getResidentPackages,
  getSocieties,
  residentArrivalPhotoProxyUrl,
  type HubPackage,
} from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import {
  firstNameFrom,
  greetingForNow,
  societyLocationLabel,
} from "@/shared/utils/greeting";

type InboxNavigation = NativeStackNavigationProp<ResidentStackParamList, "Packages">;

export function ResidentHomeScreen() {
  const navigation = useNavigation<InboxNavigation>();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ResidentSessionState | null>(null);
  const [societyName, setSocietyName] = useState("");
  const [packages, setPackages] = useState<HubPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dismissedCodIds, setDismissedCodIds] = useState<Set<string>>(new Set());
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>();

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

  // Packages still at hub / out for delivery (API drops them once Delivered).
  const awaitingCount = packages.filter((pkg) => {
    const status = pkg.status ?? "Shelved";
    return status === "Shelved" || status === "Dispatched";
  }).length;

  // Dot while something awaits the resident; COD pending also keeps the badge.
  const showBellBadge = awaitingCount > 0 || pendingCodCount > 0;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const stored = await getResidentSession();
        if (!stored) {
          resetToRoot(navigation, "ResidentLogin");
          return;
        }
        setSession(stored);

        const cached = getCachedResidentPackages(stored.residentId);
        const cacheFresh = isResidentPackagesCacheFresh(stored.residentId);
        // Stale-while-revalidate: show cache immediately, only spinner on cold start.
        if (cached && cached.length >= 0) {
          setPackages(cached);
          setLoading(false);
        } else if (!isRefresh) {
          setLoading(true);
        }

        if (cacheFresh && !isRefresh && cached) {
          setLoadError(null);
          return;
        }

        const [societies, pkgs] = await Promise.all([
          getSocieties().catch(() => []),
          getResidentPackages(stored.residentId),
        ]);
        const match = societies.find((item) => item.id === stored.societyId);
        setSocietyName(match?.name ?? "");
        setPackages(pkgs);
        setCachedResidentPackages(stored.residentId, pkgs);
        setLoadError(null);
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : "Unable to load packages. Try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigation],
  );

  useEffect(() => {
    // Resolve auth headers once for all arrival thumbs on this screen.
    void arrivalPhotoRequestHeaders(
      residentArrivalPhotoProxyUrl("preload", "preload"),
    )
      .then(setPhotoHeaders)
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Single poller — faster while COD is pending, otherwise soft refresh.
      const intervalMs = pendingCodCount > 0 ? 8000 : 20000;
      const timer = setInterval(() => {
        void load(true);
      }, intervalMs);
      return () => clearInterval(timer);
    }, [load, pendingCodCount]),
  );

  return (
    <View style={styles.root}>
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

      <View
        style={[
          styles.hero,
          {
            paddingLeft: 20 + Math.max(insets.left, 0),
            paddingRight: 20 + Math.max(insets.right, 0),
          },
        ]}
      >
        <View style={styles.heroTop}>
          <Text style={styles.location} numberOfLines={1}>
            {societyLocationLabel(societyName, session?.towerWing, session?.flatNumber)}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              const next = packages.find(
                (pkg) => pkg.isCod && pkg.codApprovalStatus === "Pending",
              );
              if (next) {
                setDismissedCodIds((prev) => {
                  const copy = new Set(prev);
                  copy.delete(next.id);
                  return copy;
                });
                return;
              }
              // No COD pending — refresh so newly shelved packages / badge update immediately.
              void load(true);
            }}
            style={styles.bell}
            accessibilityRole="button"
            accessibilityLabel={
              showBellBadge
                ? awaitingCount > 0
                  ? `Notifications, ${awaitingCount} packages awaiting you`
                  : "Notifications, COD approval needed"
                : "Notifications"
            }
          >
            <Ionicons name="notifications-outline" size={18} color="rgba(255,255,255,0.85)" />
            {showBellBadge ? <View style={styles.bellDot} /> : null}
          </Pressable>
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

      <FlatList
        data={loading && inboxPackages.length === 0 ? [] : inboxPackages}
        keyExtractor={(pkg) => pkg.id}
        contentContainerStyle={styles.list}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionTitle}>Shelved at the Hub</Text>
            <Text style={styles.sectionHint}>
              Arrival photo on each card · tap a package for details, authorize collector, or book delivery
            </Text>
            {!loading && loadError && inboxPackages.length > 0 ? (
              <Pressable style={styles.loadError} onPress={() => void load(true)}>
                <Text style={styles.loadErrorText}>Couldn’t refresh packages. Tap to retry.</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : loadError ? (
            <Pressable style={styles.loadErrorEmpty} onPress={() => void load(true)}>
              <Ionicons name="cloud-offline-outline" size={23} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Couldn’t load packages</Text>
              <Text style={styles.emptyBody}>{loadError}</Text>
              <Text style={styles.loadErrorAction}>Tap to try again</Text>
            </Pressable>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={22} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No shelved packages yet</Text>
              <Text style={styles.emptyBody}>
                Packages show here after hub staff assigns a shelf.
              </Text>
            </View>
          )
        }
        renderItem={({ item: pkg }) => (
          <InboxPackageCard
            pkg={pkg}
            residentId={session?.residentId ?? ""}
            photoHeaders={photoHeaders}
            onPress={() => navigation.navigate("PackageDetail", { pkg })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  location: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    paddingRight: 4,
  },
  bell: {
    position: "relative",
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  bellDot: {
    position: "absolute",
    top: 6,
    right: 6,
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
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
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
  loadError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  loadErrorText: { color: "#991B1B", fontSize: 12, fontWeight: "600", textAlign: "center" },
  loadErrorEmpty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  loadErrorAction: { color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: 10 },
});
