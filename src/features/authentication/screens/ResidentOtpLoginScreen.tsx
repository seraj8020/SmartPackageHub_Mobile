import { useEffect, useRef, useState, type ElementRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type OtpInputRef = ElementRef<typeof TextInput>;
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import { AuthFormScreen } from "@/features/authentication/components/AuthFormScreen";
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

const TEN_MINUTES = 10 * 60;
const OTP_LENGTH = 6;

function normalisePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ResidentOtpLoginScreen({ navigation }: Props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const otpRefs = useRef<Array<OtpInputRef | null>>([]);

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const hasExpired = expiresAt !== null && secondsLeft === 0;
  const otpDigits = Array.from({ length: OTP_LENGTH }, (_, index) => otp[index] ?? "");

  useEffect(() => {
    if (!expiresAt || secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, secondsLeft]);

  function updateOtp(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtp(digits);
    setError(null);
  }

  function handleDigitChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length > 1) {
      // SMS autofill / paste can deliver the full code into one box.
      updateOtp(cleaned);
      const focusAt = Math.min(cleaned.length, OTP_LENGTH - 1);
      otpRefs.current[focusAt]?.focus();
      return;
    }

    const chars = otp.padEnd(OTP_LENGTH, " ").split("");
    chars[index] = cleaned;
    const next = chars.join("").replace(/ /g, "").slice(0, OTP_LENGTH);
    updateOtp(next);

    if (cleaned && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyPress(index: number, key: string) {
    if (key !== "Backspace") return;
    if (otpDigits[index]) {
      const chars = otp.padEnd(OTP_LENGTH, " ").split("");
      chars[index] = " ";
      updateOtp(chars.join("").replace(/ /g, ""));
      return;
    }
    if (index > 0) {
      otpRefs.current[index - 1]?.focus();
      const chars = otp.padEnd(OTP_LENGTH, " ").split("");
      chars[index - 1] = " ";
      updateOtp(chars.join("").replace(/ /g, ""));
    }
  }

  async function sendCode() {
    const mobile = normalisePhoneNumber(phoneNumber);
    if (mobile.length !== 10) {
      setError("Enter the 10-digit mobile number you used when registering.");
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      // Match web: when SMS is off, API returns the OTP — fill the 6 boxes immediately.
      const developmentOtp = await requestResidentLoginOtp(mobile);
      setDevOtp(developmentOtp ?? null);
      updateOtp(developmentOtp ?? "");
      setExpiresAt(Date.now() + TEN_MINUTES * 1000);
      setNotice(
        developmentOtp
          ? `Dev/test code: ${developmentOtp}. SMS was not charged. Expires in 10 minutes.`
          : "SMS code sent. It expires in 10 minutes.",
      );
      if (!developmentOtp) {
        otpRefs.current[0]?.focus();
      }
    } catch (err) {
      setExpiresAt(null);
      setDevOtp(null);
      updateOtp("");
      setError(err instanceof Error ? err.message : "Unable to send code.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    const mobile = normalisePhoneNumber(phoneNumber);
    const code = otp.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!expiresAt) {
      setError("Request a code before verifying.");
      return;
    }
    if (hasExpired) {
      setError("This code has expired. Request a new code.");
      return;
    }
    if (code.length !== OTP_LENGTH) {
      setError("Enter the complete 6-digit code.");
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
      resetToRoot(navigation, "ResidentApp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify code.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthFormScreen>
      <Text style={styles.title}>Resident sign-in</Text>
      <Text style={styles.subtitle}>
        Enter your mobile number to load your society and packages
      </Text>

      <Text style={styles.label}>Mobile number</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.phonePrefix}>+91</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={(value) => setPhoneNumber(normalisePhoneNumber(value))}
          editable={!sending && !verifying}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          maxLength={10}
        />
      </View>

      <Pressable
        style={[styles.button, sending && styles.buttonDisabled]}
        onPress={() => void sendCode()}
        disabled={sending || verifying}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{expiresAt ? "Resend code" : "Send code"}</Text>
        )}
      </Pressable>

      <Text style={styles.label}>6-digit code</Text>
      <View style={styles.otpRow}>
        {otpDigits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              otpRefs.current[index] = ref;
            }}
            style={[
              styles.otpBox,
              expiresAt && !hasExpired ? styles.otpBoxActive : null,
            ]}
            value={digit}
            onChangeText={(value) => handleDigitChange(index, value)}
            onKeyPress={({ nativeEvent }) => handleDigitKeyPress(index, nativeEvent.key)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={OTP_LENGTH}
            editable={Boolean(expiresAt) && !hasExpired && !verifying}
            selectTextOnFocus
            accessibilityLabel={`Digit ${index + 1} of 6`}
          />
        ))}
      </View>

      <Text style={[styles.help, hasExpired ? styles.helpExpired : null]}>
        {expiresAt
          ? hasExpired
            ? "Code expired. Request a new code."
            : `Code expires in ${formatTime(secondsLeft)}.${devOtp ? ` Dev OTP: ${devOtp}` : ""}`
          : "Request a code to sign in securely."}
      </Text>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[
          styles.verifyButton,
          (verifying || !expiresAt || hasExpired) && styles.buttonDisabled,
        ]}
        onPress={() => void verifyCode()}
        disabled={verifying || !expiresAt || hasExpired}
      >
        {verifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify and open inbox</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.linkButton}
        onPress={() => navigation.navigate("ResidentRegister")}
        disabled={sending || verifying}
      >
        <Text style={styles.linkButtonText}>New here? Register</Text>
      </Pressable>
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700", color: colors.primary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -4 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  phonePrefix: { color: colors.textMuted, fontSize: 14, marginRight: 8 },
  phoneInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpBox: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    color: colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  otpBoxActive: {
    borderColor: colors.primary,
  },
  help: { fontSize: 11, color: colors.textMuted },
  helpExpired: { color: colors.danger },
  notice: { color: "#15803D", fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  verifyButton: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "600" },
  linkButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkButtonText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
});
