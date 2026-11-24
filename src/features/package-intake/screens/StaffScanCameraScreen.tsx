import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { IntakeCameraPanel } from "@/features/package-intake/components/IntakeCameraPanel";
import { OfflineQueueBanner } from "@/features/package-intake/components/OfflineQueueBanner";
import { QuickIntakePanel } from "@/features/package-intake/components/QuickIntakePanel";
import { usePackageIntakeSession } from "@/features/package-intake/context/PackageIntakeSessionContext";
import type { StaffScanFlowParamList } from "@/features/package-intake/navigation/staffScanFlow.types";
import { colors } from "@/shared/theme/colors";

type Nav = NativeStackNavigationProp<StaffScanFlowParamList, "ScanCamera">;

export function StaffScanCameraScreen() {
  const navigation = useNavigation<Nav>();
  const intake = usePackageIntakeSession();

  const dimSummary =
    intake.length || intake.width || intake.height || intake.weight
      ? [
          intake.weight ? `${intake.weight} kg` : null,
          intake.length || intake.width || intake.height
            ? `${intake.length || "—"} × ${intake.width || "—"} × ${intake.height || "—"} cm`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  function goBackToHome() {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
      return;
    }
    parent?.navigate("Home" as never);
  }

  return (
    <View style={styles.root}>
      <OfflineQueueBanner />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Pressable
              onPress={goBackToHome}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={styles.titleTextWrap}>
              <Text style={styles.title}>Scan package</Text>
              <Text style={styles.hint}>Barcode and OCR stay on this phone</Text>
            </View>
          </View>
        </View>

        <IntakeCameraPanel
          frameSize="large"
          cameraRef={intake.cameraRef}
          cameraOn={intake.cameraOn}
          cameraEpoch={intake.cameraEpoch}
          scanningEnabled={intake.scanningEnabled}
          reading={intake.reading}
          status={intake.status}
          confidence={intake.confidence}
          photoState={intake.photoState}
          onBarcodeScanned={intake.onBarcodeScanned}
          onCameraReady={intake.onCameraReady}
          onStartCamera={intake.startCamera}
        />

        {dimSummary ? (
          <View style={styles.dimBox}>
            <Text style={styles.dimLabel}>OCR package size</Text>
            <Text style={styles.dimValue}>{dimSummary}</Text>
          </View>
        ) : null}

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
          cameraOn={intake.cameraOn}
          parcelPhotoReady={intake.parcelPhotoReady}
          damaged={intake.damaged}
          damageNote={intake.damageNote}
          staffName={intake.staffName}
          showStaffName={false}
          onSnapParcel={() => {
            void intake.snapParcelPhoto();
          }}
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
          style={styles.continue}
          onPress={() => {
            void (async () => {
              if (intake.weight || intake.length || intake.width || intake.height) {
                intake.setDetailsOpen(true);
              }
              // OCR frames are not uploadable (too large). Capture a compressed
              // arrival still here while the camera is still mounted.
              if (!intake.parcelPhotoReady && intake.cameraOn) {
                await intake.snapParcelPhoto();
              }
              navigation.navigate("ScanDetails");
            })();
          }}
        >
          <Text style={styles.continueText}>Continue to package details</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 0 },
  titleBlock: {
    backgroundColor: colors.primary,
    marginHorizontal: -16,
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  titleTextWrap: { flex: 1, minWidth: 0 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hint: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  dimBox: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  dimLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  dimValue: { fontSize: 13, fontWeight: "800", color: "#065F46" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
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
  continue: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  continueText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  clear: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  clearText: { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },
});
