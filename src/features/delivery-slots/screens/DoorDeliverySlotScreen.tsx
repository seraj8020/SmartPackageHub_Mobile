import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { useDoorDeliveryBooking } from "@/features/delivery-slots/hooks/useDoorDeliveryBooking";
import type { PreferredDeliveryMethod } from "@/features/delivery-slots/models/deliverySlot.types";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ResidentStackParamList, "DeliveryPreference">;

const METHODS: Array<{
  id: PreferredDeliveryMethod;
  label: string;
  help: string;
}> = [
  {
    id: "DoorDelivery",
    label: "Door delivery",
    help: "Pick a time window for door drop-off",
  },
  {
    id: "CounterPickup",
    label: "Counter pickup",
    help: "Keep it at the hub shelf for you to collect",
  },
];

export function DoorDeliverySlotScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { pkg } = route.params;
  const [residentId, setResidentId] = useState("");
  const [societyId, setSocietyId] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getResidentSession().then((session) => {
      if (!active) return;
      if (!session) {
        setSessionError("Resident session is missing. Sign in again.");
        return;
      }
      setResidentId(session.residentId);
      setSocietyId(session.societyId);
    });
    return () => {
      active = false;
    };
  }, []);

  if (sessionError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{sessionError}</Text>
        <Pressable style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Back to inbox</Text>
        </Pressable>
      </View>
    );
  }

  if (!residentId || !societyId) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <DoorDeliverySlotBody
      pkg={pkg}
      residentId={residentId}
      societyId={societyId}
      topInset={insets.top}
      bottomInset={insets.bottom}
      onBack={() => navigation.goBack()}
      onBooked={() => navigation.goBack()}
    />
  );
}

function DoorDeliverySlotBody({
  pkg,
  residentId,
  societyId,
  topInset,
  bottomInset,
  onBack,
  onBooked,
}: {
  pkg: Props["route"]["params"]["pkg"];
  residentId: string;
  societyId: string;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  onBooked: () => void;
}) {
  const {
    selectedPackage,
    deliveryMethod,
    setDeliveryMethod,
    dayOptions,
    selectedDayIndex,
    setSelectedDayIndex,
    availability,
    selectedWindow,
    setSelectedWindow,
    doorNote,
    setDoorNote,
    loadingAvailability,
    booking,
    error,
    success,
    canSubmit,
    submitBooking,
  } = useDoorDeliveryBooking({ pkg, residentId, societyId });

  const subtitle = [packageTracking(selectedPackage), selectedPackage.courier, selectedPackage.flat]
    .filter(Boolean)
    .join(" · ");

  async function handleSave() {
    const ok = await submitBooking();
    if (ok) onBooked();
  }

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.hero}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to inbox</Text>
        </Pressable>
        <Text style={styles.title}>Delivery preference</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, bottomInset + 16) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.courier}>{selectedPackage.courier ?? "Courier"}</Text>
          <Text style={styles.tracking}>{packageTracking(selectedPackage)}</Text>
          {selectedPackage.preferredDeliveryMethod ? (
            <Text style={styles.currentPref}>
              Current preference:{" "}
              {selectedPackage.preferredDeliveryMethod === "CounterPickup"
                ? "Counter pickup"
                : "Door delivery"}
              {selectedPackage.deliverySlotLabel
                ? ` · ${selectedPackage.deliverySlotLabel}`
                : ""}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.legend}>How do you want this package?</Text>
          {METHODS.map((method) => {
            const active = deliveryMethod === method.id;
            return (
              <Pressable
                key={method.id}
                onPress={() => setDeliveryMethod(method.id)}
                style={[styles.methodRow, active && styles.methodRowActive]}
              >
                <View style={[styles.radio, active && styles.radioActive]} />
                <View style={styles.methodCopy}>
                  <Text style={styles.methodLabel}>{method.label}</Text>
                  <Text style={styles.methodHelp}>{method.help}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {deliveryMethod === "DoorDelivery" ? (
          <>
            <View style={styles.dayRow}>
              {dayOptions.map((day, index) => {
                const active = index === selectedDayIndex;
                return (
                  <Pressable
                    key={day.dateOnly}
                    onPress={() => setSelectedDayIndex(index)}
                    style={[styles.dayTab, active && styles.dayTabActive]}
                  >
                    <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.windowList}>
              {loadingAvailability ? (
                <Text style={styles.muted}>Checking availability…</Text>
              ) : (
                (availability?.windows ?? []).map((window) => {
                  const selected =
                    selectedWindow?.windowStart === window.windowStart &&
                    selectedWindow?.windowEnd === window.windowEnd;
                  const disabled = window.isFull || Boolean(window.isDefaultWindow);
                  return (
                    <Pressable
                      key={`${window.windowStart}-${window.windowEnd}`}
                      disabled={disabled}
                      onPress={() => setSelectedWindow(window)}
                      style={[
                        styles.windowRow,
                        disabled && styles.windowDisabled,
                        !disabled && selected && styles.windowSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.windowLabel,
                          disabled && styles.windowLabelDisabled,
                          !disabled && selected && styles.windowLabelSelected,
                        ]}
                      >
                        {window.label}
                      </Text>
                      <Text
                        style={[
                          styles.windowMeta,
                          disabled && styles.windowLabelDisabled,
                          !disabled && selected && styles.windowMetaSelected,
                        ]}
                      >
                        {window.isDefaultWindow
                          ? "Default"
                          : window.isFull
                            ? "Full"
                            : selected
                              ? "Selected"
                              : `${window.remaining} left`}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            <Text style={styles.fieldLabel}>Door note</Text>
            <TextInput
              value={doorNote}
              onChangeText={setDoorNote}
              placeholder="Call before arriving"
              placeholderTextColor="#9CA3AF"
              maxLength={500}
              style={styles.noteInput}
            />
          </>
        ) : (
          <View style={styles.counterNote}>
            <Text style={styles.counterNoteText}>
              Counter pickup keeps this package on the hub shelf. Staff will see that preference on
              Shelved and default handover to counter pickup.
            </Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.saveBtn, (booking || !canSubmit) && styles.saveBtnDisabled]}
          disabled={booking || !canSubmit}
          onPress={() => void handleSave()}
        >
          {booking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {deliveryMethod === "DoorDelivery"
                ? "Book door slot"
                : "Confirm counter pickup"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function packageTracking(pkg: Props["route"]["params"]["pkg"]) {
  return pkg.tracking || pkg.trackingNumber || pkg.pkgNumber || "Package";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FA" },
  centered: { alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  backBtn: { marginBottom: 10, alignSelf: "flex-start" },
  backBtnText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 12 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 14,
    gap: 8,
  },
  courier: { fontSize: 12, fontWeight: "700", color: colors.primary },
  tracking: { fontSize: 12, color: "#9CA3AF" },
  currentPref: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    fontWeight: "600",
    color: "#075985",
  },
  legend: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  methodRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  radio: {
    marginTop: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  radioActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  methodCopy: { flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: "700", color: colors.primary },
  methodHelp: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  dayRow: { flexDirection: "row", gap: 8 },
  dayTab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: colors.surface,
    paddingVertical: 10,
    alignItems: "center",
  },
  dayTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayTabText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  dayTabTextActive: { color: "#fff" },
  windowList: { gap: 8 },
  muted: { color: colors.textMuted, fontSize: 13, paddingVertical: 8 },
  windowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  windowSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  windowDisabled: {
    backgroundColor: "#F9FAFB",
    borderColor: "#F3F4F6",
  },
  windowLabel: { fontSize: 14, fontWeight: "700", color: colors.primary },
  windowLabelSelected: { color: "#fff" },
  windowLabelDisabled: { color: "#9CA3AF" },
  windowMeta: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  windowMetaSelected: { color: "rgba(255,255,255,0.7)" },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.primary,
  },
  counterNote: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  counterNoteText: { fontSize: 12, lineHeight: 18, color: "#92400E" },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: "#DC2626", fontSize: 12 },
  successBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText: { color: "#047857", fontSize: 12, fontWeight: "600" },
  saveBtn: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 16,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  backLink: { marginTop: 16, alignItems: "center" },
  backLinkText: { color: colors.primary, fontWeight: "600" },
});
