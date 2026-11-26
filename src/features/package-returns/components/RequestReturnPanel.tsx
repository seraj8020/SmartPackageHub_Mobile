import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReturnEligibility } from "@/features/package-returns/models/packageReturn.types";
import { colors } from "@/shared/theme/colors";

type Props = {
  eligibility: ReturnEligibility;
  busy?: boolean;
  error?: string | null;
  submitted?: boolean;
  /** Compact button used in history cards; default is detail-panel layout. */
  compact?: boolean;
  onRequest: () => void;
};

export function RequestReturnPanel({
  eligibility,
  busy = false,
  error,
  submitted = false,
  compact = false,
  onRequest,
}: Props) {
  if (compact) {
    return (
      <View>
        <Text style={[styles.message, eligibility.alreadyRequested && styles.requested]}>
          {eligibility.message}
        </Text>
        {eligibility.canRequest ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onRequest}
            style={[styles.button, busy && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{busy ? "Requesting…" : "Request return"}</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Return</Text>
      <View style={styles.card}>
        <Text style={[styles.message, eligibility.alreadyRequested && styles.requested]}>
          {eligibility.message}
        </Text>
        {eligibility.canRequest ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onRequest}
            style={[styles.button, styles.detailButton, busy && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{busy ? "Requesting…" : "Request return"}</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {submitted ? (
          <Text style={styles.success}>Return request received. Staff will guide pickup/drop.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  sectionTitle: {
    marginHorizontal: 16,
    marginBottom: 1,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  message: { marginTop: 5, color: "#526477", fontSize: 11, fontFamily: "monospace" },
  requested: { color: "#E11D48", fontWeight: "700" },
  button: {
    marginTop: 9,
    minHeight: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  detailButton: { minHeight: 46, borderRadius: 13 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  error: { marginTop: 10, color: "#B91C1C", fontSize: 12 },
  success: { marginTop: 10, color: "#166534", fontSize: 12, lineHeight: 17, fontWeight: "600" },
});
