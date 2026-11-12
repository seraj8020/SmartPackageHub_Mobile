import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ResidentMatch } from "@/features/package-intake/services/intakeApi";
import { colors } from "@/shared/theme/colors";

type Props = {
  query: string;
  searching: boolean;
  searchHits: ResidentMatch[];
  onQueryChange: (value: string) => void;
  onSelect: (resident: ResidentMatch) => void;
};

export function ResidentSearchField({
  query,
  searching,
  searchHits,
  onQueryChange,
  onSelect,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Search resident</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Name, tower, or flat"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        {searching ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      {searchHits.map((hit) => (
        <Pressable key={hit.id} style={styles.hit} onPress={() => onSelect(hit)}>
          <Text style={styles.hitName}>{hit.name}</Text>
          <Text style={styles.hitUnit}>{hit.unit}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14, color: colors.text },
  hit: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hitName: { fontSize: 13, fontWeight: "700", color: colors.text },
  hitUnit: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
