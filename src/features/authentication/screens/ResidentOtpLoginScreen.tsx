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
import {
  requestResidentLoginOtp,
  verifyResidentLoginOtp,
} from "@/features/authentication/services/residentAuthApi";
import {
  clearStaffSession,
  setResidentSession,
} from "@/features/authentication/services/sessionStorage";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ResidentLogin">;

function normalisePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function ResidentOtpLoginScreen({ navigation }: Props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendCode() {
    const mobile = normalisePhoneNumber(phoneNumber);
    if (mobile.length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const returnedOtp = await requestResidentLoginOtp(mobile);
      setCodeSent(true);
      setDevOtp(returnedOtp ?? null);
      setNotice(
        returnedOtp
          ? "SMS provider is off — use the test code below."
          : "SMS code sent. Enter it below.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send code.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    const mobile = normalisePhoneNumber(phoneNumber);
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length < 4) {
      setError("Enter the SMS code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const session = await verifyResidentLoginOtp(mobile, code);
      await clearStaffSession();
      await tokenStorage.setToken(session.token);
      await setResidentSession({
        residentId: session.residentId,
        societyId: session.societyId,
        fullName: session.fullName,
        phoneNumber: session.phoneNumber,
        towerWing: session.towerWing,
        flatNumber: session.flatNumber,
        expiresAt: Date.now() + SESSION_DURATION_MS,
      });
      navigation.replace("ResidentApp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify code.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resident sign-in</Text>
      <Text style={styles.hint}>OTP login (same API as web)</Text>

      <TextInput
        style={styles.input}
        placeholder="Mobile number"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        editable={!sending && !verifying}
        placeholderTextColor={colors.textMuted}
      />

      {codeSent ? (
        <TextInput
          style={styles.input}
          placeholder="SMS code"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
          editable={!verifying}
          placeholderTextColor={colors.textMuted}
        />
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {devOtp ? <Text style={styles.devOtp}>Test code: {devOtp}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!codeSent ? (
        <Pressable
          style={[styles.button, sending && styles.buttonDisabled]}
          onPress={() => void sendCode()}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send code</Text>
          )}
        </Pressable>
      ) : (
        <>
          <Pressable
            style={[styles.button, verifying && styles.buttonDisabled]}
            onPress={() => void verifyCode()}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify & sign in</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void sendCode()}
            disabled={sending || verifying}
          >
            <Text style={styles.secondaryButtonText}>Resend code</Text>
          </Pressable>
        </>
      )}
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
  notice: { color: colors.primary, fontSize: 13 },
  devOtp: { color: colors.primary, fontWeight: "700", fontSize: 15 },
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
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: "600" },
});
