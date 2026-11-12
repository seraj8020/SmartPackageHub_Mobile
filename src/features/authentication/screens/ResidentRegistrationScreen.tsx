import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import { AuthFormScreen } from "@/features/authentication/components/AuthFormScreen";
import type { RegisteredResident } from "@/features/authentication/models/auth.types";
import { registerResident } from "@/features/authentication/services/residentAuthApi";
import { getSocieties, type Society } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ResidentRegister">;

type RegistrationForm = {
  fullName: string;
  societyId: string;
  towerWing: string;
  flatNumber: string;
  phoneNumber: string;
};

const EMPTY_FORM: RegistrationForm = {
  fullName: "",
  societyId: "",
  towerWing: "",
  flatNumber: "",
  phoneNumber: "",
};

function normalisePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function ResidentRegistrationScreen({ navigation }: Props) {
  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(true);
  const [societyPickerOpen, setSocietyPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<RegisteredResident | null>(null);

  useEffect(() => {
    let active = true;
    void getSocieties()
      .then((items) => {
        if (active) setSocieties(items);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load societies.");
        }
      })
      .finally(() => {
        if (active) setLoadingSocieties(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const selectedSociety = societies.find((item) => item.id === form.societyId);

  async function submit() {
    const phoneNumber = normalisePhone(form.phoneNumber);
    if (
      !form.fullName.trim() ||
      !form.societyId ||
      !form.towerWing.trim() ||
      !form.flatNumber.trim() ||
      phoneNumber.length !== 10
    ) {
      setError(
        "Select your society and enter your full name, tower or wing, flat number, and a valid 10-digit mobile number.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const resident = await registerResident({
        fullName: form.fullName.trim(),
        societyId: form.societyId,
        towerWing: form.towerWing.trim().toUpperCase(),
        flatNumber: form.flatNumber.trim().toUpperCase(),
        phoneNumber,
      });
      setRegistered(resident);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <AuthFormScreen>
        <Text style={styles.title}>Registration complete</Text>
        <Text style={styles.hint}>Your resident account is ready.</Text>
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Account created for {registered.fullName}</Text>
          <Text style={styles.successMeta}>
            Tower / flat: {registered.towerWing} · {registered.flatNumber}
          </Text>
          <Text style={styles.successMeta}>Mobile: +91 {registered.phoneNumber}</Text>
          <Text style={styles.successNote}>
            Packages addressed to this tower and flat can now be matched to your account at the hub.
          </Text>
        </View>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate("ResidentLogin")}
        >
          <Text style={styles.buttonText}>Continue to sign in</Text>
        </Pressable>
      </AuthFormScreen>
    );
  }

  return (
    <AuthFormScreen>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.hint}>Register for your package hub</Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input}
        value={form.fullName}
        onChangeText={(value) => update("fullName", value)}
        placeholder="Priya Sharma"
        autoComplete="name"
        editable={!submitting}
        placeholderTextColor={colors.textMuted}
        returnKeyType="next"
      />

      <Text style={styles.label}>Society</Text>
      <Pressable
        style={[styles.input, styles.pickerButton]}
        onPress={() => setSocietyPickerOpen(true)}
        disabled={loadingSocieties || submitting}
      >
        <Text
          style={selectedSociety ? styles.pickerValue : styles.pickerPlaceholder}
        >
          {loadingSocieties
            ? "Loading societies…"
            : selectedSociety?.name ?? "Select your society"}
        </Text>
      </Pressable>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Tower / wing</Text>
          <TextInput
            style={styles.input}
            value={form.towerWing}
            onChangeText={(value) => update("towerWing", value)}
            placeholder="B"
            editable={!submitting}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            returnKeyType="next"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Flat number</Text>
          <TextInput
            style={styles.input}
            value={form.flatNumber}
            onChangeText={(value) => update("flatNumber", value)}
            placeholder="402"
            editable={!submitting}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            returnKeyType="next"
          />
        </View>
      </View>

      <Text style={styles.label}>Mobile number</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.phonePrefix}>+91</Text>
        <TextInput
          style={styles.phoneInput}
          value={form.phoneNumber}
          onChangeText={(value) => update("phoneNumber", normalisePhone(value))}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          editable={!submitting}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </View>

      <Text style={styles.footerNote}>
        All fields are required. Your mobile number receives package updates and pickup codes.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.registerButton, submitting && styles.buttonDisabled]}
        onPress={() => void submit()}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("ResidentLogin")}
        disabled={submitting}
      >
        <Text style={styles.secondaryButtonText}>I already have an account</Text>
      </Pressable>

      <Modal
        visible={societyPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSocietyPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSocietyPickerOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select society</Text>
            <FlatList
              data={societies}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.societyRow}
                  onPress={() => {
                    update("societyId", item.id);
                    setSocietyPickerOpen(false);
                  }}
                >
                  <Text style={styles.societyName}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptySocieties}>No societies available.</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700", color: colors.primary },
  hint: { color: colors.textMuted, marginBottom: 4 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  pickerButton: { justifyContent: "center" },
  pickerValue: { color: colors.text },
  pickerPlaceholder: { color: colors.textMuted },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  phonePrefix: { color: colors.textMuted, fontSize: 13, marginRight: 6 },
  phoneInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
  },
  footerNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    marginTop: 4,
  },
  registerButton: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    marginTop: 4,
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
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    padding: 16,
    gap: 8,
  },
  successTitle: { color: "#047857", fontWeight: "700", fontSize: 15 },
  successMeta: { color: colors.textMuted, fontSize: 13 },
  successNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxHeight: "70%",
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  societyRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  societyName: { color: colors.text, fontSize: 15 },
  emptySocieties: {
    color: colors.textMuted,
    padding: 16,
    textAlign: "center",
  },
});
