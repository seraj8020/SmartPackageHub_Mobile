import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { getSocieties } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";

/** Scan tab shell — camera intake wiring comes next. */
export function StaffScanPlaceholderScreen() {
  const navigation = useNavigation();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Loading society…");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const stored = await getStaffSession();
        if (!active) return;
        if (!stored) {
          resetToRoot(navigation, "StaffLogin");
          return;
        }
        setSession(stored);
        try {
          const societies = await getSocieties();
          const match = societies.find((item) => item.id === stored.primarySocietyId);
          if (active) {
            setSocietyName(
              match?.name ??
                (stored.primarySocietyId
                  ? `Society ${stored.primarySocietyId.slice(0, 8)}…`
                  : "Society"),
            );
          }
        } catch {
          if (active) setSocietyName("Society");
        }
      })();
      return () => {
        active = false;
      };
    }, [navigation]),
  );

  async function signOut() {
    await clearStaffSession();
    await tokenStorage.removeToken();
    resetToRoot(navigation, "Launch");
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.society} numberOfLines={1}>
            {societyName}
          </Text>
          <Text style={styles.user} numberOfLines={1}>
            {session?.username ?? "Staff"}
          </Text>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Package Intake</Text>
        <Text style={styles.hint}>
          Barcode and OCR stay on this phone — camera wiring comes next (same Scan tab as web).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerText: { flex: 1, minWidth: 0 },
  society: { color: "#fff", fontSize: 12, fontWeight: "700" },
  user: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
  signOut: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  body: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", color: colors.primary, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
});
