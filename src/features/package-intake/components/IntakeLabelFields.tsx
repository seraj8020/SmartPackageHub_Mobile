import { StyleSheet, Text, TextInput, View, Pressable, ScrollView } from "react-native";
import { INTAKE_COURIERS } from "@/features/package-intake/constants";
import { colors } from "@/shared/theme/colors";

type Props = {
  courier: string;
  awb: string;
  name: string;
  tower: string;
  flat: string;
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
  onCourierChange,
  onAwbChange,
  onNameChange,
  onTowerChange,
  onFlatChange,
}: Props) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Courier</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.courierRow}
      >
        {INTAKE_COURIERS.map((item) => {
          const active = item === courier;
          return (
            <Pressable
              key={item}
              onPress={() => onCourierChange(item)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
  courierRow: { gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  chipTextActive: { color: "#fff" },
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
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
});
