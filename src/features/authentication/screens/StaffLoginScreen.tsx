import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import { SESSION_DURATION_MS } from "@/features/authentication/models/auth.types";
import { loginStaff } from "@/features/authentication/services/staffAuthApi";
import {
  clearResidentSession,
  setStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "StaffLogin">;

export function StaffLoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const user = username.trim();
    if (!user || !password) {
      setError("Enter username and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await loginStaff(user, password);
      await clearResidentSession();
      await tokenStorage.setToken(session.token);
      await setStaffSession({
        userId: session.userId,
        username: session.username,
        role: session.role,
        societyIds: session.societyIds,
        primarySocietyId: session.primarySocietyId,
        expiresAt: Date.now() + SESSION_DURATION_MS,
      });
      navigation.replace("StaffApp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff sign-in</Text>
      <Text style={styles.hint}>Username / password (same API as web)</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        editable={!loading}
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        placeholderTextColor={colors.textMuted}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => void submit()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
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
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.primary },
  hint: { color: colors.textMuted, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
