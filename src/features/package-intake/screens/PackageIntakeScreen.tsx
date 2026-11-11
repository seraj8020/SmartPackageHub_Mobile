import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";

export function PackageIntakeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [session, setSession] = useState<StaffSessionState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getStaffSession().then((stored) => {
        if (!active) return;
        if (!stored) {
          navigation.replace("StaffLogin");
          return;
        }
        setSession(stored);
      });
      return () => {
        active = false;
      };
    }, [navigation]),
  );

  async function signOut() {
    await clearStaffSession();
    await tokenStorage.removeToken();
    navigation.replace("Launch");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff intake</Text>
      {session ? (
        <>
          <Text style={styles.body}>Signed in as {session.username}</Text>
          <Text style={styles.meta}>
            Role: {session.role}
            {session.primarySocietyId
              ? ` · Society ${session.primarySocietyId.slice(0, 8)}…`
              : ""}
          </Text>
        </>
      ) : (
        <Text style={styles.body}>Loading session…</Text>
      )}
      <Text style={styles.hint}>
        Camera / barcode intake screens come next.
      </Text>
      <Pressable style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "center",
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.primary },
  body: { color: colors.text, lineHeight: 20 },
  meta: { color: colors.textMuted },
  hint: { color: colors.textMuted, marginTop: 8, marginBottom: 8 },
  button: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: colors.primary, fontWeight: "600" },
});
