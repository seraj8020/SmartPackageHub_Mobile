import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  flushIntakeQueue,
  subscribeIntakeQueue,
} from "@/features/package-intake/services/intakeQueueSync";
import { colors } from "@/shared/theme/colors";

export function OfflineQueueBanner() {
  const [pending, setPending] = useState(0);

  useEffect(() => subscribeIntakeQueue(setPending), []);

  if (pending <= 0) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {pending} package{pending === 1 ? "" : "s"} waiting to sync
      </Text>
      <Pressable onPress={() => void flushIntakeQueue()} hitSlop={8}>
        <Text style={styles.action}>Retry</Text>
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
  text: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },
  action: { fontSize: 12, fontWeight: "800", color: colors.primary },
});
