import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import type { PackageReturnReason } from "@/features/package-returns/models/packageReturn.types";
import { requestPackageReturn } from "@/features/package-returns/services/packageReturnApi";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ResidentStackParamList, "ReturnRequest">;

const MAX_OTHER_NOTE_LENGTH = 240;

const reasons: Array<{ value: PackageReturnReason; label: string }> = [
  { value: "NotAsExpected", label: "Not as expected / don't like" },
  { value: "DamagedInside", label: "Damaged inside" },
  { value: "Expired", label: "Expired" },
  { value: "TechnicalFault", label: "Mechanical / technical fault" },
  { value: "Other", label: "Other" },
];

export function ResidentReturnRequestScreen({ navigation, route }: Props) {
  const { packageId, packageLabel } = route.params;
  const [reason, setReason] = useState<PackageReturnReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedLabel = reasons.find((option) => option.value === reason)?.label ?? "";
  const noteIsRequired = reason === "Other";

  function selectReason(next: PackageReturnReason) {
    setReason(next);
    setError(null);
  }

  async function submit() {
    const trimmedNote = note.trim();
    if (!reason) {
      setError("Choose a reason for your return.");
      return;
    }
    if (noteIsRequired && !trimmedNote) {
      setError("Add a note for “Other”.");
      return;
    }
    if (trimmedNote.length > MAX_OTHER_NOTE_LENGTH) {
      setError(`Keep the note to ${MAX_OTHER_NOTE_LENGTH} characters or fewer.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const session = await getResidentSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      await requestPackageReturn(packageId, session.residentId, reason, trimmedNote || undefined);
      navigation.replace("ReturnRequested", {
        packageLabel,
        reasonLabel: selectedLabel,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request return.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.select({ ios: "padding", default: undefined })}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.packageCard}>
          <Text style={styles.packageLabel}>Return package</Text>
          <Text style={styles.packageValue} numberOfLines={2}>{packageLabel}</Text>
        </View>

        <Text style={styles.sectionTitle}>Why are you returning?</Text>
        <Text style={styles.required}>Required</Text>
        <View style={styles.reasonList}>
          {reasons.map((option) => {
            const selected = option.value === reason;
            return (
              <Pressable
                key={option.value}
                onPress={() => selectReason(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.reasonRow, selected && styles.reasonRowSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.noteHeader}>
          <Text style={styles.sectionTitle}>Note {noteIsRequired ? "(required)" : "(optional)"}</Text>
          <Text style={styles.counter}>{note.length}/{MAX_OTHER_NOTE_LENGTH}</Text>
        </View>
        <TextInput
          value={note}
          onChangeText={(value) => {
            setNote(value);
            if (error) setError(null);
          }}
          placeholder={noteIsRequired ? "Tell us why you are returning this package" : "Add any useful details for staff"}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={MAX_OTHER_NOTE_LENGTH}
          textAlignVertical="top"
          style={[styles.noteInput, noteIsRequired && !note.trim() && error && styles.inputError]}
          accessibilityLabel={noteIsRequired ? "Return note, required" : "Return note, optional"}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={submitting}
          onPress={() => void submit()}
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          accessibilityRole="button"
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Submit return request</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  packageCard: { padding: 14, borderRadius: 13, backgroundColor: "#EAF1F8", borderWidth: 1, borderColor: "#D6E2EE" },
  packageLabel: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  packageValue: { marginTop: 5, color: colors.text, fontSize: 15, fontWeight: "700" },
  sectionTitle: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  required: { marginTop: 4, color: "#B91C1C", fontSize: 11, fontWeight: "700" },
  reasonList: { marginTop: 10, gap: 8 },
  reasonRow: { minHeight: 50, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 12 },
  reasonRowSelected: { borderColor: colors.primary, backgroundColor: "#F0F6FC" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "#9CA3AF", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: "#1677FF" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1677FF" },
  reasonText: { flex: 1, color: colors.text, fontSize: 13 },
  reasonTextSelected: { color: colors.primary, fontWeight: "700" },
  noteHeader: { marginTop: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { color: colors.textMuted, fontSize: 11, fontVariant: ["tabular-nums"] },
  noteInput: { minHeight: 108, marginTop: 9, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, backgroundColor: colors.surface, color: colors.text, fontSize: 13, lineHeight: 19 },
  inputError: { borderColor: "#DC2626" },
  error: { marginTop: 8, color: "#B91C1C", fontSize: 12, lineHeight: 17 },
  submitButton: { minHeight: 48, marginTop: 20, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
