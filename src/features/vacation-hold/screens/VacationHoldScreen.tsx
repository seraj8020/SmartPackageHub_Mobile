import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import { useVacationHold } from "@/features/vacation-hold/hooks/useVacationHold";
import { formatHoldRange } from "@/features/vacation-hold/utils/vacationHoldDates";
import { colors } from "@/shared/theme/colors";

export function VacationHoldScreen() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<{ residentId: string; societyId: string; towerWing?: string; flatNumber?: string } | null>(null);

  const loadSession = useCallback(() => {
    void getResidentSession().then(setSession);
  }, []);

  useFocusEffect(loadSession);

  if (!session) {
    return <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <VacationHoldBody {...session} topInset={insets.top} bottomInset={insets.bottom} />;
}

function VacationHoldBody({ residentId, societyId, towerWing, flatNumber, topInset, bottomInset }: {
  residentId: string;
  societyId: string;
  towerWing?: string;
  flatNumber?: string;
  topInset: number;
  bottomInset: number;
}) {
  const { hold, startDate, endDate, setStartDate, setEndDate, loading, busy, error, message, unitLabel, save, cancel } =
    useVacationHold(residentId, societyId, towerWing, flatNumber);
  const active = Boolean(hold?.isActive);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.hero}>
        <Text style={styles.title}>Vacation hold</Text>
        <Text style={styles.subtitle}>{unitLabel}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, bottomInset + 16) }]} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : <>
          {active && hold ? (
            <View style={styles.activeBanner}><Text style={styles.activeText}>Active · {formatHoldRange(hold.startDate, hold.endDate)}</Text></View>
          ) : (
            <View style={styles.inactiveBanner}><Text style={styles.inactiveText}>No active vacation hold. Packages can use door delivery as usual.</Text></View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Start date</Text>
            <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} style={styles.input} />
            <Text style={[styles.label, styles.endLabel]}>End date</Text>
            <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} style={styles.input} />
            <Text style={styles.help}>Enter dates as YYYY-MM-DD. The start date cannot be before today, and the end date must be after it. Overlapping active holds are not allowed.</Text>
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {message ? <View style={styles.successBox}><Text style={styles.successText}>{message}</Text></View> : null}

          <Pressable style={[styles.cancelButton, (!active || busy) && styles.disabled]} disabled={!active || busy} onPress={() => void cancel()}>
            {busy && active ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.cancelText}>Cancel hold</Text>}
          </Pressable>
          <Pressable style={[styles.saveButton, busy && styles.disabled]} disabled={busy} onPress={() => void save()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save hold</Text>}
          </Pressable>
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.58)", fontSize: 12 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  loader: { marginTop: 36 },
  activeBanner: { backgroundColor: "#10B981", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  activeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  inactiveBanner: { borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  inactiveText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 16, padding: 14 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  endLabel: { marginTop: 16 },
  input: { marginTop: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.primary, fontSize: 15 },
  help: { marginTop: 14, color: "#6B7280", fontSize: 11, lineHeight: 17 },
  errorBox: { borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { color: "#B91C1C", fontSize: 12 },
  successBox: { borderWidth: 1, borderColor: "#A7F3D0", backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  successText: { color: "#047857", fontSize: 12, lineHeight: 17 },
  cancelButton: { minHeight: 48, borderWidth: 1, borderColor: colors.primary, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  saveButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
