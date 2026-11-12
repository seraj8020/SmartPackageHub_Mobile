import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { approveCod, rejectCod } from "@/features/package-intake/services/intakeApi";
import type { HubPackage } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";

type Props = {
  pkg: HubPackage;
  onResolved: () => void;
  onDismiss: () => void;
};

export function CodApprovalDialog({ pkg, onResolved, onDismiss }: Props) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amount =
    pkg.codAmount != null && Number.isFinite(pkg.codAmount)
      ? `₹${pkg.codAmount}`
      : "COD amount";

  async function respond(approve: boolean) {
    setBusy(approve ? "approve" : "reject");
    setError(null);
    try {
      if (approve) await approveCod(pkg.id);
      else await rejectCod(pkg.id);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your response");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.top}>
            <View style={styles.iconWrap}>
              <Ionicons name="cash-outline" size={18} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Approve cash on delivery?</Text>
              <Text style={styles.body}>
                A COD package arrived at the hub. Approve the amount so staff can assign a
                shelf and send your pickup OTP.
              </Text>
            </View>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount due</Text>
            <Text style={styles.amount}>{amount}</Text>
            <Text style={styles.meta}>
              {pkg.courier} · {pkg.tracking}
            </Text>
            {pkg.pkgNumber ? <Text style={styles.pkg}>{pkg.pkgNumber}</Text> : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.reject, busy !== null && styles.disabled]}
              disabled={busy !== null}
              onPress={() => void respond(false)}
            >
              <Text style={styles.rejectText}>
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.approve, busy !== null && styles.disabled]}
              disabled={busy !== null}
              onPress={() => void respond(true)}
            >
              <Text style={styles.approveText}>
                {busy === "approve" ? "Approving…" : "Approve"}
              </Text>
            </Pressable>
          </View>
          <Pressable disabled={busy !== null} onPress={onDismiss} style={styles.later}>
            <Text style={styles.laterText}>Decide later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
  },
  top: { flexDirection: "row", gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "800", color: colors.primary },
  body: { marginTop: 4, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  amountBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  amount: { marginTop: 2, fontSize: 22, fontWeight: "800", color: colors.primary },
  meta: { marginTop: 8, fontSize: 12, color: "#4B5563" },
  pkg: { marginTop: 2, fontSize: 10, color: "#9CA3AF" },
  error: { marginTop: 10, fontSize: 12, color: colors.danger },
  actions: { marginTop: 14, flexDirection: "row", gap: 8 },
  reject: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
  },
  rejectText: { fontSize: 12, fontWeight: "800", color: colors.danger },
  approve: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
  },
  approveText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  disabled: { opacity: 0.5 },
  later: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  laterText: { fontSize: 11, fontWeight: "800", color: "#9CA3AF" },
});
