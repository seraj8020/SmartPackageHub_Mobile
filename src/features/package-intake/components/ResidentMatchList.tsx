import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { MatchView } from "@/features/package-intake/models/packageIntake.types";
import type { ResidentMatch } from "@/features/package-intake/services/intakeApi";
import { colors } from "@/shared/theme/colors";

type Props = {
  match: MatchView;
  onSelect: (resident: ResidentMatch) => void;
};

export function ResidentMatchList({ match, onSelect }: Props) {
  if (match.status === "idle") return null;

  if (match.status === "loading") {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Matching resident…</Text>
      </View>
    );
  }

  if (match.status === "missing") {
    return (
      <View style={[styles.box, styles.warn]}>
        <Text style={styles.warnText}>No resident match — confirm with tower/flat or search.</Text>
      </View>
    );
  }

  if (match.status === "error") {
    return (
      <View style={[styles.box, styles.err]}>
        <Text style={styles.errText}>{match.message}</Text>
      </View>
    );
  }

  if (match.status === "matched") {
    return (
      <View style={[styles.box, styles.ok]}>
        <Text style={styles.okTitle}>Matched</Text>
        <Text style={styles.okBody}>
          {match.resident.name} · {match.resident.unit}
        </Text>
      </View>
    );
  }

  if (match.status === "ambiguous") {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Multiple residents — pick one</Text>
        {match.residents.map((resident) => (
          <Pressable
            key={resident.id}
            style={styles.hit}
            onPress={() => onSelect(resident)}
          >
            <Text style={styles.hitName}>{resident.name}</Text>
            <Text style={styles.hitUnit}>{resident.unit}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  box: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  muted: { fontSize: 12, color: colors.textMuted },
  title: { fontSize: 12, fontWeight: "700", color: colors.text, marginBottom: 4 },
  warn: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  warnText: { fontSize: 12, color: "#92400E", lineHeight: 17 },
  err: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  errText: { fontSize: 12, color: colors.danger },
  ok: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  okTitle: { fontSize: 11, fontWeight: "800", color: "#047857", textTransform: "uppercase" },
  okBody: { fontSize: 13, fontWeight: "600", color: colors.text },
  hit: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  hitName: { fontSize: 13, fontWeight: "700", color: colors.text },
  hitUnit: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
