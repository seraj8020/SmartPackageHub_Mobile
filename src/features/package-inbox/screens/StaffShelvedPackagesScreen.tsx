import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StaffStackParamList } from "@/app/navigation/types";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { ArrivalPhotoThumb } from "@/features/package-inbox/components/ArrivalPhotoThumb";
import { useStaffReceive } from "@/features/package-inbox/hooks/useStaffReceive";
import { clearStaffPackagesCache } from "@/features/package-inbox/services/staffPackageCache";
import { invalidateDispatchedPackagesCache } from "@/features/package-handover/services/handoverPackageCache";
import {
  arrivalPhotoRequestHeaders,
  getSocieties,
  staffArrivalPhotoProxyUrl,
  type HubPackage,
} from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";
import { formatUnitLabel } from "@/shared/utils/formatUnitLabel";
import { StaffReturnsScreen } from "@/features/package-returns/screens/StaffReturnsScreen";

export function StaffShelvedPackagesScreen({ route }: NativeStackScreenProps<StaffStackParamList, "Shelf">) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Society");

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
      <View style={styles.root}>
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
      initialSection={route.params?.section ?? "intake"}
      societyName={societyName}
      username={session.username}
      topInset={insets.top}
      sideInset={Math.max(insets.left, insets.right, 0)}
      onSignOut={async () => {
        for (const cachedSocietyId of new Set(session.societyIds ?? [societyId])) {
          if (cachedSocietyId) {
            clearStaffPackagesCache(cachedSocietyId);
            invalidateDispatchedPackagesCache(cachedSocietyId);
          }
        }
        await clearStaffSession();
        await tokenStorage.removeToken();
        resetToRoot(navigation, "Launch");
      }}
    />
  );
}

function StaffShelvedBody({
  societyId,
  initialSection,
  societyName,
  username,
  topInset,
  sideInset,
  onSignOut,
}: {
  societyId: string;
  initialSection: "intake" | "returns";
  societyName: string;
  username: string;
  topInset: number;
  sideInset: number;
  onSignOut: () => Promise<void>;
}) {
  const [section, setSection] = useState<"intake" | "returns">(initialSection);
  const {
    hubPackages,
    packageLoadError,
    loadingId,
    errors,
    dispatch,
    reload,
  } = useStaffReceive(societyId);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>();

  useEffect(() => {
    void arrivalPhotoRequestHeaders(staffArrivalPhotoProxyUrl("preload"))
      .then(setPhotoHeaders)
      .catch(() => undefined);
  }, []);

  useEffect(() => setSection(initialSection), [initialSection]);

  const pending = hubPackages.filter(
    (pkg) =>
      (pkg.status ? pkg.status === "Shelved" : Boolean(pkg.shelfCode)),
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredPending = normalizedSearch
    ? pending.filter((pkg) =>
        [pkg.recipientName, pkg.tower, pkg.towerWing, pkg.flat, pkg.flatNumber]
          .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)),
      )
    : pending;

  async function handleDispatch(pkg: HubPackage) {
    const ok = await dispatch(pkg);
    if (ok) return;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shelved Packages</Text>
        <Text style={styles.headerSub}>
          Manage intake and resident returns
        </Text>
      </View>

      <View style={styles.sectionTabs}>
        <Pressable onPress={() => setSection("intake")} style={[styles.sectionTab, section === "intake" && styles.sectionTabActive]}>
          <Text style={[styles.sectionTabText, section === "intake" && styles.sectionTabTextActive]}>Intake packages</Text>
        </Pressable>
        <Pressable onPress={() => setSection("returns")} style={[styles.sectionTab, section === "returns" && styles.sectionTabActive]}>
          <Text style={[styles.sectionTabText, section === "returns" && styles.sectionTabTextActive]}>Return packages</Text>
        </Pressable>
      </View>

      {section === "returns" ? <StaffReturnsScreen embedded /> : (
      <FlatList
        data={
          packageLoadError && pending.length === 0
            ? []
            : pending.length === 0
              ? []
              : filteredPending
        }
        keyExtractor={(pkg) => pkg.id}
        contentContainerStyle={styles.list}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
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
        ListHeaderComponent={
          <View>
            <Text style={styles.countLabel}>On shelf ({filteredPending.length})</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color="#9CA3AF" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, tower or flat"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                returnKeyType="search"
                style={styles.searchInput}
                accessibilityLabel="Search shelved packages by name, tower or flat"
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          packageLoadError && pending.length === 0 ? (
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
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matching packages</Text>
              <Text style={styles.emptyBody}>Try another name, tower or flat.</Text>
            </View>
          )
        }
        renderItem={({ item: pkg }) => {
          const error = errors[pkg.id];
          const isLoading = loadingId === pkg.id;
          const counter = pkg.preferredDeliveryMethod === "CounterPickup";
          const door = pkg.preferredDeliveryMethod === "DoorDelivery";
          return (
            <View style={[styles.card, error ? styles.cardDanger : null]}>
              <View style={styles.cardMain}>
                <ArrivalPhotoThumb pkg={pkg} size={56} photoHeaders={photoHeaders} />
                <View style={styles.cardBody}>
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
                </View>
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
              {pkg.damageNote ? <Text style={styles.hubNote}>Hub intake note · {pkg.damageNote}</Text> : null}
              {error ? <Text style={styles.itemError}>{error}</Text> : null}
            </View>
          );
        }}
      />
      )}
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
  sectionTabs: { flexDirection: "row", backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D8E0E8" },
  sectionTab: { flex: 1, alignItems: "center", paddingHorizontal: 8, paddingVertical: 9, borderRadius: 9, backgroundColor: "#F1F5F9" },
  sectionTabActive: { backgroundColor: colors.primary },
  sectionTabText: { color: "#64748B", fontSize: 11, fontWeight: "800" },
  sectionTabTextActive: { color: "#fff" },
  list: { padding: 16, paddingBottom: 40 },
  searchBox: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, paddingVertical: 9 },
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
  cardMain: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardBody: { flex: 1, minWidth: 0 },
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
  hubNote: { marginTop: 8, fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", padding: 8, borderRadius: 8 },
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
