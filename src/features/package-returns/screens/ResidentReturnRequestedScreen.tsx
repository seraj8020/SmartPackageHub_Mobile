import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ResidentStackParamList, "ReturnRequested">;

export function ResidentReturnRequestedScreen({ navigation, route }: Props) {
  const { packageLabel, reasonLabel, note } = route.params;
  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View style={styles.iconWrap}><Ionicons name="checkmark" size={34} color="#047857" /></View>
        <Text style={styles.title}>Return request received</Text>
        <Text style={styles.body}>Staff will review your reason and guide the next step.</Text>

        <View style={styles.summary}>
          <Text style={styles.label}>Package</Text>
          <Text style={styles.value}>{packageLabel}</Text>
          <Text style={[styles.label, styles.reasonLabel]}>Return reason</Text>
          <Text style={styles.value}>{reasonLabel}</Text>
          {note ? <><Text style={[styles.label, styles.reasonLabel]}>Note</Text><Text style={styles.note}>{note}</Text></> : null}
        </View>

        <Pressable onPress={() => navigation.navigate("History")} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Back to history</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, alignItems: "center" },
  iconWrap: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0", marginTop: 20 },
  title: { marginTop: 16, color: colors.primary, fontSize: 19, fontWeight: "800", textAlign: "center" },
  body: { marginTop: 8, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  summary: { alignSelf: "stretch", marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.9, textTransform: "uppercase" },
  value: { marginTop: 4, color: colors.text, fontSize: 14, fontWeight: "700" },
  reasonLabel: { marginTop: 15 },
  note: { marginTop: 4, color: colors.text, fontSize: 13, lineHeight: 18 },
  button: { alignSelf: "stretch", minHeight: 48, marginTop: 20, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
