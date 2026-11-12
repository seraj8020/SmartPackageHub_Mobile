import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weight: string;
  length: string;
  width: string;
  height: string;
  category: string;
  isColdStorage: boolean;
  isCod: boolean;
  codAmount: string;
  onWeightChange: (v: string) => void;
  onLengthChange: (v: string) => void;
  onWidthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onColdStorageChange: (v: boolean) => void;
  onCodChange: (v: boolean) => void;
  onCodAmountChange: (v: string) => void;
};

export function PackageDetailsPanel(props: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => props.onOpenChange(!props.open)} style={styles.toggle}>
        <Text style={styles.toggleText}>
          {props.open ? "Hide package details" : "Package details (optional)"}
        </Text>
      </Pressable>
      {props.open ? (
        <View style={styles.body}>
          <Field label="Category" value={props.category} onChange={props.onCategoryChange} />
          <View style={styles.row}>
            <HalfField label="Weight kg" value={props.weight} onChange={props.onWeightChange} keyboardType="decimal-pad" />
            <HalfField label="Length cm" value={props.length} onChange={props.onLengthChange} keyboardType="decimal-pad" />
          </View>
          <View style={styles.row}>
            <HalfField label="Width cm" value={props.width} onChange={props.onWidthChange} keyboardType="decimal-pad" />
            <HalfField label="Height cm" value={props.height} onChange={props.onHeightChange} keyboardType="decimal-pad" />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Cold storage</Text>
            <Switch
              value={props.isColdStorage}
              onValueChange={props.onColdStorageChange}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>COD</Text>
            <Switch
              value={props.isCod}
              onValueChange={props.onCodChange}
              trackColor={{ true: colors.primary }}
            />
          </View>
          {props.isCod ? (
            <Field
              label="COD amount"
              value={props.codAmount}
              onChange={props.onCodAmountChange}
              keyboardType="decimal-pad"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
    </View>
  );
}

function HalfField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  return (
    <View style={{ flex: 1 }}>
      <Field {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
  },
  toggleText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  body: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
  },
  row: { flexDirection: "row", gap: 10 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  switchLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
});
