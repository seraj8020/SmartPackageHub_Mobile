import { useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { IntakeLabelFields } from "@/features/package-intake/components/IntakeLabelFields";
import { OfflineQueueBanner } from "@/features/package-intake/components/OfflineQueueBanner";
import { PackageDetailsPanel } from "@/features/package-intake/components/PackageDetailsPanel";
import { ReceivedIntakeCard } from "@/features/package-intake/components/ReceivedIntakeCard";
import { ResidentMatchList } from "@/features/package-intake/components/ResidentMatchList";
import { ResidentSearchField } from "@/features/package-intake/components/ResidentSearchField";
import { usePackageIntakeSession } from "@/features/package-intake/context/PackageIntakeSessionContext";
import type { StaffScanFlowParamList } from "@/features/package-intake/navigation/staffScanFlow.types";
import { colors } from "@/shared/theme/colors";

type Nav = NativeStackNavigationProp<StaffScanFlowParamList, "ScanDetails">;

export function StaffScanDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const intake = usePackageIntakeSession();

  // OCR may fill L×W×H on the camera screen — keep the size panel open here.
  useEffect(() => {
    if (intake.weight || intake.length || intake.width || intake.height) {
      intake.setDetailsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open when OCR values appear
  }, [intake.weight, intake.length, intake.width, intake.height]);

  if (intake.receipt) {
    return (
      <View style={styles.root}>
        <ReceivedIntakeCard
          receipt={intake.receipt}
          courierFallback={intake.courier}
          damageState={intake.damageState}
          photoState={intake.photoState}
          onScanAnother={() => {
            intake.reset();
            navigation.navigate("ScanCamera");
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <OfflineQueueBanner />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        <Text style={styles.label}>Staff name</Text>
        <TextInput
          value={intake.staffName}
          onChangeText={intake.setStaffName}
          placeholder="Hub Staff"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        {intake.damaged ? (
          <View style={styles.damageChip}>
            <Text style={styles.damageChipText}>
              Damage photo on file
              {intake.damageNote.trim() ? ` · ${intake.damageNote.trim()}` : ""}
            </Text>
          </View>
        ) : null}

        {intake.parcelPhotoReady ? (
          <Text style={styles.photoHint}>Parcel photo ready · uploads on confirm</Text>
        ) : (
          <Text style={styles.photoWarn}>
            No parcel photo yet — go back to camera and tap Snap parcel (OCR re-read is not a parcel photo)
          </Text>
        )}

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

        <Pressable style={styles.back} onPress={() => navigation.navigate("ScanCamera")}>
          <Text style={styles.backText}>Back to camera</Text>
        </Pressable>

        <Pressable
          style={styles.clear}
          onPress={() => {
            intake.reset();
            navigation.navigate("ScanCamera");
          }}
        >
          <Text style={styles.clearText}>Clear and rescan</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
  },
  damageChip: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  damageChipText: { fontSize: 12, fontWeight: "700", color: "#991B1B" },
  photoHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  photoWarn: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
  },
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
  back: { marginTop: 10, paddingVertical: 10, alignItems: "center" },
  backText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  clear: { marginTop: 2, paddingVertical: 10, alignItems: "center" },
  clearText: { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },
});
