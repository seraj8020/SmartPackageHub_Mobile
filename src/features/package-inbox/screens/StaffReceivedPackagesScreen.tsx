import { useCallback, useEffect, useState } from "react";
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
import { IntakeReceiptCard } from "@/features/package-intake/components/IntakeReceiptCard";
import { ShelfAssignmentForm } from "@/features/package-intake/components/ShelfAssignmentForm";
import {
  assignShelf,
  suggestShelf,
  type ConfirmIntakeResult,
} from "@/features/package-intake/services/intakeApi";
import { useStaffReceive } from "@/features/package-inbox/hooks/useStaffReceive";
import { useShelfPicker } from "@/features/shelf-management/hooks/useShelfPicker";
import { rowFromShelfCode } from "@/features/shelf-management/utils/shelfCapacity";
import { getSocieties, type HubPackage } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";
import { SignOutButton } from "@/shared/ui/SignOutButton";
import { formatUnitLabel } from "@/shared/utils/formatUnitLabel";

function codLabel(pkg: HubPackage): string | null {
  if (!pkg.isCod) return null;
  if (pkg.codApprovalStatus === "Pending") {
    return pkg.codAmount != null
      ? `COD ₹${pkg.codAmount} · awaiting approval`
      : "COD · awaiting approval";
  }
  if (pkg.codApprovalStatus === "Rejected") {
    return pkg.codAmount != null
      ? `COD ₹${pkg.codAmount} · rejected`
      : "COD · rejected";
  }
  if (pkg.codApprovalStatus === "Approved") {
    return pkg.codAmount != null
      ? `COD ₹${pkg.codAmount} · approved`
      : "COD · approved";
  }
  return pkg.codAmount != null ? `COD ₹${pkg.codAmount}` : "COD";
}

function canAssignShelf(pkg: HubPackage): boolean {
  if (!pkg.isCod) return true;
  return pkg.codApprovalStatus === "Approved";
}

export function StaffReceivedPackagesScreen() {
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
          if (active) {
            setSocietyName(match?.name ?? "Society");
          }
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
          <Text style={styles.headerTitle}>Received</Text>
        </View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <StaffReceivedBody
      societyId={societyId}
      societyName={societyName}
      username={session.username}
      topInset={insets.top}
      sideInset={Math.max(insets.left, insets.right, 0)}
      onSignOut={async () => {
        await clearStaffSession();
        await tokenStorage.removeToken();
        resetToRoot(navigation, "Launch");
      }}
    />
  );
}

function StaffReceivedBody({
  societyId,
  societyName,
  username,
  topInset,
  sideInset,
  onSignOut,
}: {
  societyId: string;
  societyName: string;
  username: string;
  topInset: number;
  sideInset: number;
  onSignOut: () => Promise<void>;
}) {
  const {
    hubPackages,
    loadingPackages,
    packageLoadError,
    reload,
  } = useStaffReceive(societyId);
  const shelfPicker = useShelfPicker(societyId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shelf, setShelf] = useState("A-1");
  const [row, setRow] = useState("A");
  const [suggested, setSuggested] = useState("A-1");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ConfirmIntakeResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const received = hubPackages.filter((pkg) => (pkg.status ?? "Received") === "Received");
  const selectedShelf = shelfPicker.findOption(shelf);

  useEffect(() => {
    if (!societyId) return;
    suggestShelf(societyId)
      .then((result) => {
        if (!result.shelfCode) return;
        setSuggested(result.shelfCode);
        setShelf(result.shelfCode);
        setRow(rowFromShelfCode(result.shelfCode));
      })
      .catch(() => undefined);
  }, [societyId]);

  useEffect(() => {
    if (shelfPicker.visible.length === 0) return;
    const current = shelfPicker.visible.find(
      (item) => item.code.toLowerCase() === shelf.trim().toLowerCase(),
    );
    if (current) {
      if (current.row !== row) setRow(current.row);
      return;
    }
    const match =
      shelfPicker.visible.find(
        (item) => item.code.toLowerCase() === suggested.trim().toLowerCase(),
      ) ??
      shelfPicker.visible.find((item) => !item.isFull) ??
      shelfPicker.visible[0];
    if (!match) return;
    setShelf(match.code);
    setRow(match.row);
  }, [suggested, shelfPicker.visible]);

  function openAssignFor(pkg: HubPackage) {
    setError(null);
    const preferCold = Boolean(pkg.isColdStorage);
    shelfPicker.preferStorage(preferCold);
    const pool = shelfPicker.options.filter((item) =>
      preferCold ? item.isColdStorage : !item.isColdStorage,
    );
    const openShelf =
      pool.find(
        (item) =>
          item.code.toLowerCase() === suggested.toLowerCase() && !item.isFull,
      ) ??
      pool.find((item) => !item.isFull) ??
      pool[0];
    if (openShelf) {
      setShelf(openShelf.code);
      setRow(openShelf.row);
    }
    setSelectedId((current) => (current === pkg.id ? null : pkg.id));
  }

  async function handleAssignShelf(pkg: HubPackage) {
    if (!canAssignShelf(pkg)) {
      setError("COD must be approved by the resident before shelving.");
      return;
    }
    setBusyId(pkg.id);
    setError(null);
    try {
      const isCold = selectedShelf?.isColdStorage ?? Boolean(pkg.isColdStorage);
      const result = await assignShelf(pkg.id, shelf, isCold);
      shelfPicker.markAssigned(shelf);
      setReceipt(result);
      setSelectedId(null);
      reload();
      shelfPicker.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign shelf");
    } finally {
      setBusyId(null);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    reload();
    shelfPicker.reload();
    setTimeout(() => setRefreshing(false), 600);
  }

  if (receipt) {
    return (
      <View style={[styles.root, { paddingTop: topInset }]}>
        <IntakeReceiptCard
          receipt={receipt}
          courierFallback={receipt.courier || "Courier"}
          onBack={() => {
            setReceipt(null);
            setError(null);
            reload();
            shelfPicker.reload();
          }}
          backLabel="Back to Received"
        />
      </View>
    );
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
        <Text style={styles.headerTitle}>Received</Text>
        <Text style={styles.headerSub}>
          Assign cold or ambient shelves · free slots update as you shelve
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Waiting ({received.length})</Text>
          <Pressable onPress={() => void onRefresh()} hitSlop={8}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </Pressable>
        </View>

        {loadingPackages && received.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : packageLoadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{packageLoadError}</Text>
            <Pressable onPress={reload}>
              <Text style={styles.retry}>Retry loading packages</Text>
            </Pressable>
          </View>
        ) : received.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={22} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No received packages</Text>
            <Text style={styles.emptyBody}>
              Scan packages first. They appear here until a shelf is assigned.
            </Text>
          </View>
        ) : (
          received.map((pkg) => {
            const open = selectedId === pkg.id;
            const assignable = canAssignShelf(pkg);
            const cod = codLabel(pkg);
            return (
              <View key={pkg.id} style={styles.card}>
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
                  <Text style={styles.chipReceived}>Received</Text>
                  {pkg.isColdStorage ? <Text style={styles.chipCold}>Needs cold</Text> : null}
                  {cod ? <Text style={styles.chipCod}>{cod}</Text> : null}
                </View>

                <Pressable
                  style={[styles.assignBtn, !assignable && styles.assignBtnDisabled]}
                  disabled={!assignable || busyId !== null}
                  onPress={() => openAssignFor(pkg)}
                >
                  <Text style={styles.assignBtnText}>
                    {!assignable
                      ? pkg.codApprovalStatus === "Rejected"
                        ? "COD rejected"
                        : "Awaiting COD approval"
                      : open
                        ? "Hide shelf picker"
                        : "Assign shelf"}
                  </Text>
                </Pressable>

                {open ? (
                  <>
                    <ShelfAssignmentForm
                      shelf={shelf}
                      row={row}
                      suggested={suggested}
                      storageFilter={shelfPicker.storageFilter}
                      rows={shelfPicker.rows}
                      options={shelfPicker.visible}
                      loading={shelfPicker.loading}
                      loadError={shelfPicker.error}
                      onStorageFilterChange={shelfPicker.setStorageFilter}
                      onRowChange={setRow}
                      onShelfChange={setShelf}
                      onRetryLoad={shelfPicker.reload}
                    />
                    <Pressable
                      style={[styles.confirmBtn, busyId === pkg.id && styles.assignBtnDisabled]}
                      disabled={busyId !== null}
                      onPress={() => void handleAssignShelf(pkg)}
                    >
                      <Text style={styles.confirmBtnText}>
                        {busyId === pkg.id ? "Saving shelf…" : `Confirm · ${shelf}`}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            );
          })
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
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
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  recipient: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.primary },
  unit: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },
  courier: { marginTop: 4, fontSize: 11, fontWeight: "700", color: colors.text },
  tracking: { marginTop: 2, fontSize: 10, color: "#9CA3AF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chipReceived: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0369A1",
    backgroundColor: "#E0F2FE",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipCold: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0369A1",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipCod: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  assignBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  assignBtnDisabled: { opacity: 0.45 },
  assignBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  confirmBtn: {
    marginTop: 10,
    backgroundColor: "#10B981",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
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
