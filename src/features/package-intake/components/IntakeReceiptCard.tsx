import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import type { ConfirmIntakeResult } from "@/features/package-intake/services/intakeApi";
import { colors } from "@/shared/theme/colors";

type Props = {
  receipt: ConfirmIntakeResult;
  courierFallback: string;
  onBack?: () => void;
  backLabel?: string;
  damageState?: string | null;
  photoState?: string | null;
};

export function IntakeReceiptCard({
  receipt,
  courierFallback,
  onBack,
  backLabel = "Back to Received",
  damageState,
  photoState,
}: Props) {
  const qrPayload = (receipt.pickupQrPayload ?? "").trim();
  const showPickup = Boolean(receipt.pickupOtp) || Boolean(qrPayload);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backRow} hitSlop={8}>
            <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.backText}>{backLabel}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.headerTitle}>Intake saved</Text>
        <Text style={styles.headerSub}>
          {receipt.shelfCode ? "Shelf assigned." : "Shelf is unassigned."} Resident notice is
          queued.
        </Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={styles.pkg}>{receipt.pkgNumber}</Text>
        </View>
        <Text style={styles.shelf}>
          {receipt.shelfCode ? `Shelf ${receipt.shelfCode}` : "Shelf unassigned"}
        </Text>
        <Text style={styles.meta}>
          {receipt.courier || courierFallback} · {receipt.awb}
        </Text>
        {receipt.resident ? (
          <Text style={styles.resident}>
            {receipt.resident.name} · {receipt.resident.unit}
          </Text>
        ) : null}

        {showPickup ? (
          <View style={styles.pickupRow}>
            {qrPayload ? (
              <View style={styles.qrWrap}>
                <QRCode
                  value={qrPayload}
                  size={96}
                  backgroundColor="#FFFFFF"
                  color={colors.primary}
                />
              </View>
            ) : null}
            <View style={styles.otpCol}>
              {receipt.pickupOtp ? (
                <>
                  <Text style={styles.otpLabel}>Pickup OTP</Text>
                  <Text style={styles.otpValue}>{receipt.pickupOtp}</Text>
                </>
              ) : null}
              <Text style={styles.otpHint}>Push and WhatsApp queued</Text>
              {qrPayload ? (
                <Text style={styles.otpHint}>Resident can scan QR or enter OTP</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {damageState ? <Text style={styles.note}>{damageState}</Text> : null}
        {photoState ? <Text style={styles.note}>{photoState}</Text> : null}
      </View>
      {onBack ? (
        <Pressable style={styles.cta} onPress={onBack}>
          <Text style={styles.ctaText}>{backLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  backText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" },
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
  shelf: { fontSize: 26, fontWeight: "800", color: colors.primary, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  resident: { fontSize: 12, color: colors.text, marginTop: 8, fontWeight: "600" },
  pickupRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  qrWrap: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  otpCol: { flex: 1, minWidth: 0 },
  otpLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  otpValue: { marginTop: 4, fontSize: 22, fontWeight: "800", color: colors.primary },
  otpHint: { marginTop: 4, fontSize: 10, color: colors.textMuted },
  note: { marginTop: 10, fontSize: 11, color: colors.textMuted },
  cta: {
    marginHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
