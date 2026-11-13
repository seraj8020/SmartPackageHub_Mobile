import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  flushIntakeQueue,
  subscribeIntakeQueue,
} from "@/features/package-intake/services/intakeQueueSync";
import { getLatestIntakeQueueError } from "@/features/package-intake/services/intakeQueueDb";
import { colors } from "@/shared/theme/colors";

export function OfflineQueueBanner() {
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeIntakeQueue(setPending);
    void getLatestIntakeQueueError().then(setLastError).catch(() => setLastError(null));
    return unsub;
  }, []);

  if (pending <= 0) return null;

  async function onRetry() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await flushIntakeQueue({ force: true });
      setLastError(result.lastError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.text}>
          {pending} package{pending === 1 ? "" : "s"} waiting to sync
        </Text>
        {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      </View>
      <Pressable onPress={() => void onRetry()} hitSlop={8} disabled={busy}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.action}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  copy: { flex: 1, gap: 2 },
  text: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  error: { fontSize: 11, color: "#B45309", fontWeight: "500" },
  action: { fontSize: 12, fontWeight: "800", color: colors.primary },
});
