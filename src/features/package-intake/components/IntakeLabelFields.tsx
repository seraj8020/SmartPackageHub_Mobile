import { StyleSheet, Text, TextInput, View } from "react-native";
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
      <Text style={styles.label}>Courier (required)</Text>
      <TextInput
        value={courier}
        onChangeText={onCourierChange}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="Type if OCR did not fill"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />

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
            autoCapitalize="characters"
            placeholder="101 / 3M"
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
