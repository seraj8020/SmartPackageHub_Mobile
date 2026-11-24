import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = {
  cameraOn: boolean;
  parcelPhotoReady: boolean;
  damaged: boolean;
  damageNote: string;
  staffName: string;
  onSnapParcel: () => void;
  onMarkDamaged: () => void;
  onDamageNoteChange: (value: string) => void;
  onStaffNameChange: (value: string) => void;
  /** Hide staff name when it lives on the details screen. */
  showStaffName?: boolean;
};

export function QuickIntakePanel({
  cameraOn,
  parcelPhotoReady,
  damaged,
  damageNote,
  staffName,
  onSnapParcel,
  onMarkDamaged,
  onDamageNoteChange,
  onStaffNameChange,
  showStaffName = true,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionHint}>
        Normal packages: snap the parcel box. Damaged: use the red button for a separate damage photo.
      </Text>
      <Pressable
        onPress={onSnapParcel}
        disabled={!cameraOn}
        style={[
          styles.parcelBtn,
          parcelPhotoReady && styles.parcelBtnOn,
          !cameraOn && styles.btnDisabled,
        ]}
      >
        <Text style={[styles.parcelText, parcelPhotoReady && styles.parcelTextOn]}>
          {!cameraOn
            ? "Open camera to snap parcel"
            : parcelPhotoReady
              ? "Parcel photo captured · tap to re-snap"
              : "Snap parcel photo"}
        </Text>
      </Pressable>
      <Pressable
        onPress={onMarkDamaged}
        disabled={!cameraOn}
        style={[
          styles.damageBtn,
          damaged && styles.damageBtnOn,
          !cameraOn && styles.btnDisabled,
        ]}
      >
        <Text style={[styles.damageText, damaged && styles.damageTextOn]}>
          {!cameraOn
            ? "Open camera to mark damaged"
            : damaged
              ? "Damage photo captured · tap to re-snap"
              : "Mark damaged · snap box"}
        </Text>
      </Pressable>
      {damaged ? (
        <TextInput
          value={damageNote}
          onChangeText={onDamageNoteChange}
          placeholder="Damage note (optional)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
      ) : null}
      {showStaffName ? (
        <>
          <Text style={styles.label}>Staff name</Text>
          <TextInput
            value={staffName}
            onChangeText={onStaffNameChange}
            placeholder="Hub Staff"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  sectionHint: {
    marginBottom: 8,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
    fontWeight: "600",
  },
  parcelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    marginBottom: 8,
  },
  parcelBtnOn: { backgroundColor: "#DBEAFE", borderColor: "#60A5FA" },
  parcelText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  parcelTextOn: { color: "#1E40AF" },
  damageBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
  },
  damageBtnOn: { backgroundColor: "#FEE2E2", borderColor: "#F87171" },
  damageText: { fontSize: 12, fontWeight: "800", color: colors.danger },
  damageTextOn: { color: "#991B1B" },
  btnDisabled: { opacity: 0.45 },
  label: {
    marginTop: 10,
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
    marginTop: 8,
  },
});
