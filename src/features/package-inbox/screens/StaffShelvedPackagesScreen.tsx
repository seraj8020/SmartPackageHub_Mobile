import { useCallback, useState } from "react";
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
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { useStaffReceive } from "@/features/package-inbox/hooks/useStaffReceive";
import { getSocieties, type HubPackage } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";
import { SignOutButton } from "@/shared/ui/SignOutButton";
import { formatUnitLabel } from "@/shared/utils/formatUnitLabel";

export function StaffShelvedPackagesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Society");
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
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
          const match = societies.find((item) => item.id === stored.primarySocietyId);
          if (active) setSocietyName(match?.name ?? "Society");
        } catch {
          if (active) setSocietyName("Society");
        }
      })();
      return () => {
        active = false;
      };
    }, [navigation]),
  );

  const societyId = session?.primarySocietyId ?? session?.societyIds?.[0] ?? "";

  if (!session) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shelved Packages</Text>
        </View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <StaffShelvedBody
      societyId={societyId}
      societyName={societyName}
      username={session.username}
      topInset={insets.top}
      sideInset={Math.max(insets.left, insets.right, 0)}
      dispatchedIds={dispatchedIds}
      onDispatched={(pkg) => {
        setDispatchedIds((prev) => new Set([...prev, pkg.id]));
      }}
      onSignOut={async () => {
        await clearStaffSession();
        await tokenStorage.removeToken();
        resetToRoot(navigation, "Launch");
      }}
    />
  );
}

function StaffShelvedBody({
  societyId,
  societyName,
  username,
  topInset,
  sideInset,
  dispatchedIds,
  onDispatched,
  onSignOut,
}: {
  societyId: string;
  societyName: string;
  username: string;
  topInset: number;
  sideInset: number;
  dispatchedIds: Set<string>;
  onDispatched: (pkg: HubPackage) => void;
  onSignOut: () => Promise<void>;
}) {
  const {
    hubPackages,
    loadingPackages,
    packageLoadError,
    loadingId,
    errors,
    dispatch,
    reload,
  } = useStaffReceive(societyId);
  const [refreshing, setRefreshing] = useState(false);

  const pending = hubPackages.filter(
    (pkg) =>
      !dispatchedIds.has(pkg.id) &&
      (pkg.status ? pkg.status === "Shelved" : Boolean(pkg.shelfCode)),
  );

  async function handleDispatch(pkg: HubPackage) {
    const ok = await dispatch(pkg);
    if (ok) onDispatched(pkg);
  }

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
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
        <SignOutButton onPress={() => void onSignOut()} />
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shelved Packages</Text>
        <Text style={styles.headerSub}>
          All packages still on shelf · not yet dispatched
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              reload();
              setTimeout(() => setRefreshing(false), 600);
            }}
          />
        }
      >
        <Text style={styles.countLabel}>On shelf ({pending.length})</Text>

        {loadingPackages && pending.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : packageLoadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{packageLoadError}</Text>
            <Pressable onPress={reload}>
              <Text style={styles.retry}>Retry loading packages</Text>
            </Pressable>
          </View>
        ) : pending.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={22} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No shelved packages</Text>
            <Text style={styles.emptyBody}>
              Assign a shelf from Inbox to move packages here.
            </Text>
          </View>
        ) : (
          pending.map((pkg) => {
            const error = errors[pkg.id];
            const isLoading = loadingId === pkg.id;
            const counter = pkg.preferredDeliveryMethod === "CounterPickup";
            const door = pkg.preferredDeliveryMethod === "DoorDelivery";
            return (
              <View key={pkg.id} style={[styles.card, error ? styles.cardDanger : null]}>
                <View style={styles.cardTop}>
                  <Text style={styles.recipient} numberOfLines={1}>
                    {pkg.recipientName || "Recipient"}
                  </Text>
                  <Text style={styles.unit}>
                    {formatUnitLabel(pkg.tower ?? pkg.towerWing, pkg.flat || pkg.flatNumber)}
                  </Text>
                </View>
                <Text style={styles.courier}>{pkg.courier}</Text>
                <Text style={styles.tracking}>{pkg.tracking}</Text>
                <View style={styles.chips}>
                  <Text style={styles.shelfChip}>
                    {pkg.shelfCode ? `Shelf ${pkg.shelfCode}` : "Shelf unassigned"}
                  </Text>
                </View>
                {counter ? (
                  <Text style={styles.modeViolet}>
                    Delivery mode · Counter pickup · keep at hub
                  </Text>
                ) : door ? (
                  <Text style={styles.modeGreen}>
                    Delivery mode · Door delivery
                    {pkg.deliverySlotLabel ? ` · ${pkg.deliverySlotLabel}` : ""}
                  </Text>
                ) : pkg.deliverySlotLabel ? (
                  <Text
                    style={
                      pkg.deliverySlotStatus === "booked"
                        ? styles.modeGreen
                        : styles.modeAmber
                    }
                  >
                    {pkg.deliverySlotStatus === "booked"
                      ? `Resident booked door ${pkg.deliverySlotLabel}`
                      : `Door slot ${pkg.deliverySlotLabel} (default)`}
                  </Text>
                ) : (
                  <Text style={styles.modeGray}>Delivery mode · not set by resident</Text>
                )}

                <View style={styles.footer}>
                  <Text style={styles.meta}>
                    {pkg.category}
                    {pkg.weight ? ` · ${pkg.weight}` : ""}
                  </Text>
                  {counter ? (
                    <Text style={styles.keepChip}>Keep at hub</Text>
                  ) : (
                    <Pressable
                      style={[styles.dispatchBtn, loadingId !== null && styles.disabled]}
                      disabled={loadingId !== null}
                      onPress={() => void handleDispatch(pkg)}
                    >
                      <Text style={styles.dispatchText}>
                        {isLoading
                          ? "Sending…"
                          : door
                            ? "Dispatch for door"
                            : "Ready to Dispatch"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {error ? <Text style={styles.itemError}>{error}</Text> : null}
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
  topBar: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topBarText: { flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 8 },
  society: { color: "#fff", fontSize: 12, fontWeight: "700" },
  user: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  list: { padding: 16, paddingBottom: 40 },
  countLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 12,
    marginBottom: 10,
  },
  cardDanger: { borderColor: "#FECACA" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  recipient: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.primary },
  unit: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },
  courier: { marginTop: 4, fontSize: 11, fontWeight: "700", color: colors.text },
  tracking: { marginTop: 2, fontSize: 10, color: "#9CA3AF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  shelfChip: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  modeViolet: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: "#5B21B6",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  modeGreen: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: "#065F46",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  modeAmber: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  modeGray: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  footer: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  meta: { flex: 1, fontSize: 10, color: "#6B7280" },
  keepChip: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5B21B6",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  dispatchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disabled: { opacity: 0.55 },
  dispatchText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  itemError: { marginTop: 8, fontSize: 12, color: colors.danger },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyTitle: { marginTop: 8, fontSize: 14, fontWeight: "700", color: "#4B5563" },
  emptyBody: { marginTop: 4, fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  errorBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { fontSize: 12, color: colors.danger },
  retry: { marginTop: 8, fontSize: 12, fontWeight: "800", color: colors.primary },
});
