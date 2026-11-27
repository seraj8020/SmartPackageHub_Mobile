import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { getResidentProfile } from "@/features/authentication/services/residentAuthApi";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import type {
  SupportCategoryId,
  SupportTicket,
  SupportUrgency,
} from "@/features/resident-support/models/support.types";
import {
  createSupportRequest,
  getResidentSupportConfig,
  listSupportRequests,
} from "@/features/resident-support/services/supportApi";
import {
  SPH_SUPPORT_EMAIL,
  SUPPORT_CATEGORIES,
  SUPPORT_URGENCIES,
} from "@/features/resident-support/utils/supportContent";
import { getSocieties, getSocietyById } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";

function sameId(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function formatTicketWhen(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";
}

export function ResidentSupportScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [residentName, setResidentName] = useState("");
  const [residentId, setResidentId] = useState("");
  const [societyId, setSocietyId] = useState("");
  const [societyName, setSocietyName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [towerWing, setTowerWing] = useState<string | undefined>();
  const [flatNumber, setFlatNumber] = useState<string | undefined>();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("all");
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [urgencyPickerOpen, setUrgencyPickerOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [categoryId, setCategoryId] = useState<SupportCategoryId>("other");
  const [urgency, setUrgency] = useState<SupportUrgency>("Normal");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const category = useMemo(
    () => SUPPORT_CATEGORIES.find((item) => item.id === categoryId) ?? SUPPORT_CATEGORIES[0],
    [categoryId],
  );

  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const status = (ticket.status || "Open").trim().toLowerCase();
      if (statusFilter === "open" && status !== "open") return false;
      if (!q) return true;
      return (
        ticket.referenceCode.toLowerCase().includes(q) ||
        ticket.subject.toLowerCase().includes(q)
      );
    });
  }, [search, statusFilter, tickets]);

  const statusFilterLabel = statusFilter === "open" ? "Open" : "All";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getResidentSession();
      if (!session) {
        setError("Your session has expired. Please sign in again.");
        setTickets([]);
        return;
      }

      const profile = await getResidentProfile(session.residentId).catch(() => null);
      const resolvedResidentId = profile?.id?.trim() || session.residentId;
      const resolvedSocietyId = profile?.societyId?.trim() || session.societyId;

      setResidentName(profile?.fullName?.trim() || session.fullName?.trim() || "Resident");
      setResidentId(resolvedResidentId);
      setSocietyId(resolvedSocietyId);
      setPhoneNumber(profile?.phoneNumber || session.phoneNumber);
      setTowerWing(profile?.towerWing || session.towerWing);
      setFlatNumber(profile?.flatNumber || session.flatNumber);

      const [societies, societyDetail, supportConfig, rows] = await Promise.all([
        getSocieties().catch(() => []),
        getSocietyById(resolvedSocietyId).catch(() => null),
        getResidentSupportConfig().catch(() => ({
          supportEmail: SPH_SUPPORT_EMAIL,
          supportPhone: undefined as string | undefined,
        })),
        listSupportRequests(resolvedResidentId).catch(() => [] as SupportTicket[]),
      ]);
      void supportConfig;

      const match =
        societies.find((row) => sameId(row.id, resolvedSocietyId)) ??
        (societyDetail && sameId(societyDetail.id, resolvedSocietyId) ? societyDetail : null);

      setSocietyName(
        profile?.societyName?.trim() ||
          match?.name?.trim() ||
          societyDetail?.name?.trim() ||
          "",
      );
      setTickets(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openComposer() {
    setSubject("");
    setCategoryId("other");
    setUrgency("Normal");
    setMessage("");
    setError(null);
    setComposerOpen(true);
  }

  async function submitRequest() {
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (cleanSubject.length < 2) {
      setError("Enter a short subject.");
      return;
    }
    if (cleanMessage.length < 8) {
      setError("Describe your issue in a bit more detail.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const session = await getResidentSession();
      if (!session) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const profile = await getResidentProfile(session.residentId).catch(() => null);
      const resolvedResidentId = profile?.id?.trim() || residentId || session.residentId;
      if (!resolvedResidentId) {
        setError("Resident details are missing. Please sign in again.");
        return;
      }

      const created = await createSupportRequest({
        residentId: resolvedResidentId,
        societyId: profile?.societyId?.trim() || societyId || session.societyId,
        subject: cleanSubject,
        category: category.label,
        urgency,
        message: cleanMessage,
        residentName: profile?.fullName?.trim() || residentName,
        residentPhone: profile?.phoneNumber || phoneNumber || session.phoneNumber,
        towerWing: profile?.towerWing || towerWing,
        flatNumber: profile?.flatNumber || flatNumber,
      });

      setTickets((current) => [created, ...current.filter((row) => row.id !== created.id)]);
      setComposerOpen(false);
      setSubject("");
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your request.");
    } finally {
      setBusy(false);
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
        {societyName ? (
          <View style={styles.societyBadge}>
            <Text style={styles.societyBadgeText}>{societyName}</Text>
          </View>
        ) : null}

        <Text style={styles.title}>Support</Text>
        <Text style={styles.subtitle}>
          Raise a request with the SPH team and track the conversation.
        </Text>

        <Pressable style={styles.newButton} onPress={openComposer} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newButtonText}>New support request</Text>
        </Pressable>

        <View style={styles.toolbar}>
          <Pressable
            style={styles.statusDropdown}
            onPress={() => setStatusPickerOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.statusDropdownText}>{statusFilterLabel}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search reference or subject"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error && !composerOpen ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : visibleTickets.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="help-buoy-outline" size={22} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {statusFilter === "open" ? "No open requests" : "No support requests yet"}
            </Text>
            <Text style={styles.emptyBody}>
              {statusFilter === "open"
                ? "Switch the filter to All, or raise a new support request."
                : "Tap New support request to raise one."}
            </Text>
          </View>
        ) : (
          visibleTickets.map((ticket) => (
            <Pressable
              key={ticket.id || ticket.referenceCode}
              style={styles.ticketCard}
              onPress={() => setSelectedTicket(ticket)}
              accessibilityRole="button"
            >
              <View style={styles.ticketTop}>
                <Text style={styles.reference}>{ticket.referenceCode || "—"}</Text>
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>{ticket.status || "Open"}</Text>
                </View>
              </View>
              <Text style={styles.ticketSubject}>{ticket.subject || "(No subject)"}</Text>
              <View style={styles.ticketMeta}>
                <View style={styles.urgencyBadge}>
                  <Text style={styles.urgencyBadgeText}>{ticket.urgency || "Normal"}</Text>
                </View>
                <Text style={styles.ticketWhen}>{formatTicketWhen(ticket.requestedAtUtc)}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New support request</Text>
              <Pressable onPress={() => setComposerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Short summary"
                placeholderTextColor="#9CA3AF"
                editable={!busy}
              />

              <Text style={styles.label}>Category</Text>
              <Pressable
                style={[styles.input, styles.dropdown]}
                onPress={() => setCategoryPickerOpen(true)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.dropdownValue}>{category.label}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>

              <Text style={styles.label}>Urgency</Text>
              <Pressable
                style={[styles.input, styles.dropdown]}
                onPress={() => setUrgencyPickerOpen(true)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.dropdownValue}>{urgency}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your issue or request in detail…"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                editable={!busy}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.submitButton, busy && styles.buttonDisabled]}
                onPress={() => void submitRequest()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit request</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={statusPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setStatusPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Filter</Text>
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "open" as const, label: "Open" },
              ] as const
            ).map((item) => {
              const selected = statusFilter === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                  onPress={() => {
                    setStatusFilter(item.id);
                    setStatusPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, selected && styles.pickerRowTextSelected]}>
                    {item.label}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={selectedTicket != null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTicket(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedTicket?.referenceCode || "Request"}</Text>
              <Pressable onPress={() => setSelectedTicket(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailRow}>
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>{selectedTicket?.status || "Open"}</Text>
                </View>
                <View style={styles.urgencyBadge}>
                  <Text style={styles.urgencyBadgeText}>{selectedTicket?.urgency || "Normal"}</Text>
                </View>
              </View>
              <Text style={styles.label}>Subject</Text>
              <Text style={styles.detailValue}>{selectedTicket?.subject || "—"}</Text>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.detailValue}>{selectedTicket?.category || "—"}</Text>
              <Text style={styles.label}>Message</Text>
              <Text style={styles.detailMessage}>{selectedTicket?.message || "—"}</Text>
              <Text style={styles.label}>Submitted</Text>
              <Text style={styles.detailValue}>{formatTicketWhen(selectedTicket?.requestedAtUtc)}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setCategoryPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Category</Text>
            {SUPPORT_CATEGORIES.map((item) => {
              const selected = item.id === categoryId;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                  onPress={() => {
                    setCategoryId(item.id);
                    setCategoryPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, selected && styles.pickerRowTextSelected]}>
                    {item.label}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={urgencyPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUrgencyPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setUrgencyPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Urgency</Text>
            {SUPPORT_URGENCIES.map((item) => {
              const selected = item === urgency;
              return (
                <Pressable
                  key={item}
                  style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                  onPress={() => {
                    setUrgency(item);
                    setUrgencyPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, selected && styles.pickerRowTextSelected]}>
                    {item}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  societyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  societyBadgeText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 6, marginBottom: 16, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  newButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  newButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  toolbar: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  statusDropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusDropdownText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  searchInput: {
    flexGrow: 1,
    minWidth: 160,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },
  loader: { marginTop: 28 },
  empty: {
    marginTop: 16,
    alignItems: "center",
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: { marginTop: 8, color: colors.text, fontSize: 14, fontWeight: "700" },
  emptyBody: { marginTop: 4, color: colors.textMuted, fontSize: 12, textAlign: "center" },
  ticketCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
  },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reference: { color: "#2563EB", fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  openBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  openBadgeText: { color: "#1D4ED8", fontSize: 11, fontWeight: "700" },
  ticketSubject: { marginTop: 8, color: colors.text, fontSize: 15, fontWeight: "700" },
  ticketMeta: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  urgencyBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  urgencyBadgeText: { color: "#4B5563", fontSize: 11, fontWeight: "700" },
  ticketWhen: { color: colors.textMuted, fontSize: 11 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  detailMessage: { color: colors.text, fontSize: 14, lineHeight: 21 },
  errorBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    padding: 12,
  },
  errorText: { marginTop: 8, color: colors.danger, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  label: {
    marginTop: 12,
    marginBottom: 6,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  messageInput: { minHeight: 120 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownValue: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pickerCard: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 10,
    maxHeight: "70%",
  },
  pickerTitle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  pickerRow: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pickerRowSelected: { backgroundColor: colors.primaryMuted },
  pickerRowText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  pickerRowTextSelected: { color: colors.primary },
  submitButton: {
    marginTop: 16,
    marginBottom: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  buttonDisabled: { opacity: 0.7 },
});
