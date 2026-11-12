import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { IntakeCameraPanel } from "@/features/package-intake/components/IntakeCameraPanel";
import { IntakeLabelFields } from "@/features/package-intake/components/IntakeLabelFields";
import { OfflineQueueBanner } from "@/features/package-intake/components/OfflineQueueBanner";
import { PackageDetailsPanel } from "@/features/package-intake/components/PackageDetailsPanel";
import { QuickIntakePanel } from "@/features/package-intake/components/QuickIntakePanel";
import { ReceivedIntakeCard } from "@/features/package-intake/components/ReceivedIntakeCard";
import { ResidentMatchList } from "@/features/package-intake/components/ResidentMatchList";
import { ResidentSearchField } from "@/features/package-intake/components/ResidentSearchField";
import { usePackageIntake } from "@/features/package-intake/hooks/usePackageIntake";
import { startIntakeQueueSync } from "@/features/package-intake/services/intakeQueueSync";
import { getSocieties } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";

export function StaffScanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Loading society…");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      startIntakeQueueSync();
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
            setSocietyName(
              match?.name ??
                (stored.primarySocietyId
                  ? `Society ${stored.primarySocietyId.slice(0, 8)}…`
                  : "Society"),
            );
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
  const staffUserId = session?.userId ?? "";

  if (!session || !staffUserId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.society}>Staff intake</Text>
        </View>
        <Text style={styles.loading}>Loading session…</Text>
      </View>
    );
  }

  return (
    <StaffScanBody
      societyId={societyId}
      staffUserId={staffUserId}
      societyName={societyName}
      username={session.username}
      topInset={insets.top}
      onSignOut={async () => {
        await clearStaffSession();
        await tokenStorage.removeToken();
        resetToRoot(navigation, "Launch");
      }}
    />
  );
}

function StaffScanBody({
  societyId,
  staffUserId,
  societyName,
  username,
  topInset,
  onSignOut,
}: {
  societyId: string;
  staffUserId: string;
  societyName: string;
  username: string;
  topInset: number;
  onSignOut: () => Promise<void>;
}) {
  const intake = usePackageIntake({ societyId, staffUserId });

  if (intake.receipt) {
    return (
      <View style={[styles.root, { paddingTop: topInset }]}>
        <ReceivedIntakeCard
          receipt={intake.receipt}
          courierFallback={intake.courier}
          damageState={intake.damageState}
          photoState={intake.photoState}
          onScanAnother={intake.reset}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: topInset }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.society} numberOfLines={1}>
            {societyName}
          </Text>
          <Text style={styles.user} numberOfLines={1}>
            {username}
          </Text>
        </View>
        <Pressable onPress={() => void onSignOut()} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <OfflineQueueBanner />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Package Intake</Text>
          <Text style={styles.hint}>Barcode and OCR stay on this phone</Text>
        </View>

        <IntakeCameraPanel
          cameraRef={intake.cameraRef}
          cameraOn={intake.cameraOn}
          scanningEnabled={intake.scanningEnabled}
          reading={intake.reading}
          status={intake.status}
          confidence={intake.confidence}
          photoState={intake.photoState}
          onBarcodeScanned={intake.onBarcodeScanned}
        />

        <IntakeLabelFields
          courier={intake.courier}
          awb={intake.awb}
          name={intake.name}
          tower={intake.tower}
          flat={intake.flat}
          onCourierChange={intake.setCourierEdited}
          onAwbChange={intake.setAwbEdited}
          onNameChange={intake.setNameEdited}
          onTowerChange={intake.setTowerEdited}
          onFlatChange={intake.setFlatEdited}
        />

        <PackageDetailsPanel
          open={intake.detailsOpen}
          onOpenChange={intake.setDetailsOpen}
          weight={intake.weight}
          length={intake.length}
          width={intake.width}
          height={intake.height}
          category={intake.category}
          isColdStorage={intake.isColdStorage}
          isCod={intake.isCod}
          codAmount={intake.codAmount}
          onWeightChange={intake.setWeight}
          onLengthChange={intake.setLength}
          onWidthChange={intake.setWidth}
          onHeightChange={intake.setHeight}
          onCategoryChange={intake.setCategory}
          onColdStorageChange={intake.setIsColdStorage}
          onCodChange={intake.setIsCod}
          onCodAmountChange={intake.setCodAmount}
        />

        <ResidentMatchList match={intake.match} onSelect={intake.chooseResident} />

        <ResidentSearchField
          query={intake.query}
          searching={intake.searching}
          searchHits={intake.searchHits}
          onQueryChange={intake.setQuery}
          onSelect={intake.chooseResident}
        />

        <View style={styles.actions}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={intake.rereadLabel}
            disabled={intake.reading || !intake.cameraOn}
          >
            <Text style={styles.secondaryText}>Re-read label (OCR)</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={intake.resumeScanning}>
            <Text style={styles.secondaryText}>Scan barcode again</Text>
          </Pressable>
        </View>

        <QuickIntakePanel
          damaged={intake.damaged}
          damageNote={intake.damageNote}
          staffName={intake.staffName}
          onMarkDamaged={() => {
            void intake.markDamaged();
          }}
          onDamageNoteChange={intake.setDamageNote}
          onStaffNameChange={intake.setStaffName}
        />

        {intake.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{intake.error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.confirm, (!intake.canConfirm || intake.busy) && styles.confirmDisabled]}
          disabled={!intake.canConfirm || intake.busy}
          onPress={() => {
            void intake.confirm();
          }}
        >
          <Text style={styles.confirmText}>
            {intake.busy ? "Saving intake…" : "Confirm intake · Received"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.clear}
          onPress={intake.cameraOn ? intake.stopCamera : intake.reset}
        >
          <Text style={styles.clearText}>
            {intake.cameraOn ? "Stop camera" : "Clear"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerText: { flex: 1, minWidth: 0 },
  society: { color: "#fff", fontSize: 12, fontWeight: "700" },
  user: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
  signOut: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  loading: { padding: 20, color: colors.textMuted },
  scroll: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 8 },
  titleBlock: {
    backgroundColor: colors.primary,
    marginHorizontal: -16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hint: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  secondaryText: { fontSize: 11, fontWeight: "800", color: colors.primary },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { fontSize: 12, color: colors.danger },
  confirm: {
    marginTop: 12,
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmDisabled: { opacity: 0.4 },
  confirmText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  clear: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  clearText: { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },
});
