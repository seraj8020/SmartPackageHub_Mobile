import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = {
  damaged: boolean;
  damageNote: string;
  staffName: string;
  onMarkDamaged: () => void;
  onDamageNoteChange: (value: string) => void;
  onStaffNameChange: (value: string) => void;
};

export function QuickIntakePanel({
  damaged,
  damageNote,
  staffName,
  onMarkDamaged,
  onDamageNoteChange,
  onStaffNameChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onMarkDamaged}
        style={[styles.damageBtn, damaged && styles.damageBtnOn]}
      >
        <Text style={[styles.damageText, damaged && styles.damageTextOn]}>
          {damaged ? "Damage photo captured" : "Mark damaged · snap box"}
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
      <Text style={styles.label}>Staff name</Text>
      <TextInput
        value={staffName}
        onChangeText={onStaffNameChange}
        placeholder="Hub Staff"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
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
