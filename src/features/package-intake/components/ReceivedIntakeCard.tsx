import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ConfirmIntakeResult } from "@/features/package-intake/services/intakeApi";
import { colors } from "@/shared/theme/colors";

type Props = {
  receipt: ConfirmIntakeResult;
  courierFallback: string;
  damageState: string | null;
  photoState: string | null;
  onScanAnother: () => void;
};

export function ReceivedIntakeCard({
  receipt,
  courierFallback,
  damageState,
  photoState,
  onScanAnother,
}: Props) {
  const offline = Boolean(receipt.queuedOffline);
  const amount =
    receipt.codAmount != null && Number.isFinite(receipt.codAmount)
      ? `₹${receipt.codAmount}`
      : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {offline ? "Queued offline" : "Intake saved"}
        </Text>
        <Text style={styles.headerSub}>
          {offline
            ? "Will sync to hub when connectivity returns"
            : "Status: Received · shelf & OTP happen later"}
        </Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons
            name={offline ? "cloud-offline-outline" : "checkmark-circle"}
            size={18}
            color={offline ? "#B45309" : "#059669"}
          />
          <Text style={styles.pkg}>{receipt.pkgNumber}</Text>
        </View>
        <Text style={styles.status}>{offline ? "Queued" : "Received"}</Text>
        <Text style={styles.meta}>
          {receipt.courier || courierFallback} · {receipt.awb}
        </Text>
        {receipt.resident ? (
          <Text style={styles.resident}>
            {receipt.resident.name} · {receipt.resident.unit}
          </Text>
        ) : null}
        <View style={styles.info}>
          <Text style={styles.infoText}>
            {offline
              ? "Continue scanning. Pending intakes flush via POST /api/v2/intake/batch-intake with the same clientRequestId."
              : "Courier can leave. Assign a shelf from the Inbox tab when ready."}
          </Text>
        </View>
        {receipt.isCod ? (
          <View style={styles.cod}>
            <Text style={styles.codTitle}>COD · awaiting approval</Text>
            {amount ? <Text style={styles.codAmt}>{amount}</Text> : null}
          </View>
        ) : null}
        {damageState ? <Text style={styles.foot}>{damageState}</Text> : null}
        {photoState ? <Text style={styles.foot}>{photoState}</Text> : null}
      </View>
      <Pressable style={styles.cta} onPress={onScanAnother}>
        <Text style={styles.ctaText}>Scan another package</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4 },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  pkg: { fontSize: 14, fontWeight: "800", color: "#059669" },
  status: { fontSize: 28, fontWeight: "800", color: colors.primary, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  resident: { fontSize: 12, color: colors.text, marginTop: 8, fontWeight: "600" },
  info: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  infoText: { fontSize: 12, color: "#1E3A8A", lineHeight: 17 },
  cod: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  codTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  codAmt: { marginTop: 4, fontSize: 18, fontWeight: "800", color: "#78350F" },
  foot: { marginTop: 10, fontSize: 11, color: colors.textMuted },
  cta: {
    marginHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
