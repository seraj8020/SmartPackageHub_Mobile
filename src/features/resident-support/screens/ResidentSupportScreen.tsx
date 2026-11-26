import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import type { SupportTopicId } from "@/features/resident-support/models/support.types";
import {
  createSupportRequest,
  getResidentSupportConfig,
} from "@/features/resident-support/services/supportApi";
import {
  SPH_SUPPORT_EMAIL,
  SUPPORT_FAQS,
  SUPPORT_TOPICS,
} from "@/features/resident-support/utils/supportContent";
import { getSocieties, type Society } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";

type SocietyContact = Pick<Society, "id" | "name" | "contactEmail" | "phone">;

export function ResidentSupportScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [residentName, setResidentName] = useState("");
  const [residentId, setResidentId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [towerWing, setTowerWing] = useState<string | undefined>();
  const [flatNumber, setFlatNumber] = useState<string | undefined>();
  const [society, setSociety] = useState<SocietyContact | null>(null);
  const [configEmail, setConfigEmail] = useState(SPH_SUPPORT_EMAIL);
  const [configPhone, setConfigPhone] = useState<string | undefined>();
  const [topicId, setTopicId] = useState<SupportTopicId>("missing_package");
  const [message, setMessage] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string | null>(SUPPORT_FAQS[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const topic = useMemo(
    () => SUPPORT_TOPICS.find((item) => item.id === topicId) ?? SUPPORT_TOPICS[0],
    [topicId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getResidentSession();
      if (!session) {
        setError("Your session has expired. Please sign in again.");
        setSociety(null);
        return;
      }
      setResidentName(session.fullName?.trim() || "Resident");
      setResidentId(session.residentId);
      setPhoneNumber(session.phoneNumber);
      setTowerWing(session.towerWing);
      setFlatNumber(session.flatNumber);

      const [societies, supportConfig] = await Promise.all([
        getSocieties(),
        getResidentSupportConfig().catch(() => ({
          supportEmail: SPH_SUPPORT_EMAIL,
          supportPhone: undefined as string | undefined,
        })),
      ]);
      setConfigEmail(supportConfig.supportEmail || SPH_SUPPORT_EMAIL);
      setConfigPhone(supportConfig.supportPhone);

      const match = societies.find((row) => row.id === session.societyId) ?? null;
      setSociety(
        match
          ? {
              id: match.id,
              name: match.name,
              contactEmail: match.contactEmail,
              phone: match.phone,
            }
          : { id: session.societyId, name: "Your society" },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load support contacts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const supportEmail = configEmail || society?.contactEmail?.trim() || SPH_SUPPORT_EMAIL;
  const supportPhone = configPhone?.trim() || society?.phone?.trim();

  async function sendAsk() {
    const trimmed = message.trim();
    if (trimmed.length < 8) {
      setError("Add a short note (at least a sentence) so the hub team can help.");
      return;
    }
    if (!society || !residentId) {
      setError("Society details are missing. Pull to refresh or sign in again.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createSupportRequest({
        residentId,
        societyId: society.id,
        topic: topic.label,
        message: trimmed,
        residentName,
        residentPhone: phoneNumber,
        towerWing,
        flatNumber,
      });
      setMessage("");
      setSuccess(result.message || `Request sent. We will follow up at ${result.supportEmail || supportEmail}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  }

  async function callHub() {
    if (!supportPhone) {
      setError("No hub phone number is on file for your society.");
      return;
    }
    const digits = supportPhone.replace(/[^\d+]/g, "");
    const url = `tel:${digits}`;
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not start a phone call.");
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 28 + Math.max(insets.bottom, 12) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Support</Text>
          <Text style={styles.heroTitle}>Ask from where you are stuck</Text>
          <Text style={styles.heroBody}>
            Like Traizr in-app support: your society, flat, and topic go with the question so the hub
            team does not need three messages of setup.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Attached context</Text>
              <Text style={styles.contextLine}>
                {residentName}
                {towerWing || flatNumber
                  ? ` · ${[towerWing, flatNumber].filter(Boolean).join("-")}`
                  : ""}
              </Text>
              <Text style={styles.contextMuted}>{society?.name ?? "Society"}</Text>
            </View>

            <Text style={styles.sectionTitle}>What do you need help with?</Text>
            <View style={styles.topicWrap}>
              {SUPPORT_TOPICS.map((item) => {
                const selected = item.id === topicId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setTopicId(item.id)}
                    style={[styles.topicChip, selected && styles.topicChipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.topicLabel, selected && styles.topicLabelSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.topicHint}>{topic.hint}</Text>

            <Text style={styles.sectionTitle}>Your question</Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe what happened and what you need…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              editable={!busy}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <Pressable
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={() => void sendAsk()}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Ask hub team</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.emailHint}>Routed to {supportEmail}</Text>

            {supportPhone ? (
              <Pressable style={styles.secondaryButton} onPress={() => void callHub()}>
                <Ionicons name="call-outline" size={17} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Call hub · {supportPhone}</Text>
              </Pressable>
            ) : null}

            <Text style={[styles.sectionTitle, styles.faqTitle]}>Quick answers</Text>
            {SUPPORT_FAQS.map((faq) => {
              const open = openFaqId === faq.id;
              return (
                <Pressable
                  key={faq.id}
                  style={styles.faqCard}
                  onPress={() => setOpenFaqId(open ? null : faq.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={open ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                  {open ? <Text style={styles.faqAnswer}>{faq.answer}</Text> : null}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: { marginTop: 6, color: "#fff", fontSize: 20, fontWeight: "700" },
  heroBody: { marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 19 },
  loader: { marginTop: 28 },
  contextCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  contextLine: { marginTop: 6, color: colors.text, fontSize: 14, fontWeight: "700" },
  contextMuted: { marginTop: 2, color: colors.textMuted, fontSize: 12 },
  sectionTitle: {
    marginBottom: 8,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  topicWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  topicLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  topicLabelSelected: { color: "#fff" },
  topicHint: { marginTop: 8, marginBottom: 14, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  input: {
    minHeight: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  error: { marginTop: 10, color: colors.danger, fontSize: 13 },
  success: { marginTop: 10, color: colors.primary, fontSize: 13, lineHeight: 18 },
  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emailHint: { marginTop: 8, color: colors.textMuted, fontSize: 11, textAlign: "center" },
  secondaryButton: {
    marginTop: 10,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  faqTitle: { marginTop: 22 },
  faqCard: {
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  faqHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  faqQuestion: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  faqAnswer: { marginTop: 8, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
