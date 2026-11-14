import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "@/shared/theme/colors";
import { sortCarriersForDropdown } from "@/features/package-intake/services/intakeApi";

const OTHER_ONLY = ["Other"] as const;

type Props = {
  courier: string;
  awb: string;
  name: string;
  tower: string;
  flat: string;
  carriers?: readonly string[];
  onCourierChange: (value: string) => void;
  onAwbChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onTowerChange: (value: string) => void;
  onFlatChange: (value: string) => void;
};

export function IntakeLabelFields({
  courier,
  awb,
  name,
  tower,
  flat,
  carriers,
  onCourierChange,
  onAwbChange,
  onNameChange,
  onTowerChange,
  onFlatChange,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const options = sortCarriersForDropdown(
    carriers && carriers.length > 0 ? carriers : OTHER_ONLY,
  );
  const courierValue = options.includes(courier) ? courier : "";

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Courier</Text>
      <Pressable
        style={[styles.input, styles.dropdown]}
        onPress={() => setPickerOpen(true)}
      >
        <Text
          style={[
            styles.dropdownValue,
            !courierValue && styles.dropdownPlaceholder,
          ]}
        >
          {courierValue || "Select courier"}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </Pressable>

      <Text style={styles.label}>AWB / tracking</Text>
      <TextInput
        value={awb}
        onChangeText={onAwbChange}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Scan or type tracking number"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />

      <Text style={styles.label}>Recipient name</Text>
      <TextInput
        value={name}
        onChangeText={onNameChange}
        placeholder="From OCR or search"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Tower</Text>
          <TextInput
            value={tower}
            onChangeText={onTowerChange}
            autoCapitalize="characters"
            placeholder="A"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Flat</Text>
          <TextInput
            value={flat}
            onChangeText={onFlatChange}
            keyboardType="number-pad"
            placeholder="101"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
        </View>
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select courier</Text>
            <FlatList
              data={[...options]}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item === courierValue;
                return (
                  <Pressable
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      onCourierChange(item);
                      setPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.optionText, active && styles.optionTextActive]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 8 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
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
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownValue: { fontSize: 14, color: colors.text, fontWeight: "600" },
  dropdownPlaceholder: { color: "#9CA3AF", fontWeight: "500" },
  dropdownChevron: { fontSize: 12, color: colors.textMuted },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxHeight: "70%",
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  optionRowActive: { backgroundColor: colors.primaryMuted },
  optionText: { color: colors.text, fontSize: 15 },
  optionTextActive: { color: colors.primary, fontWeight: "700" },
});
