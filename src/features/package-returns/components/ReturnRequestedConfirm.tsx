import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/shared/theme/colors";

type Props = {
  onBack: () => void;
};

export function ReturnRequestedConfirm({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <Text style={styles.title}>Return requested</Text>
        <Text style={styles.subtitle}>We’ll notify society staff</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Ionicons name="checkmark-outline" size={36} color={colors.primary} />
          <Text style={styles.heading}>Request received</Text>
          <Text style={styles.body}>Staff will guide pickup/drop at the hub desk.</Text>
          <Text style={styles.badge}>Return requested</Text>
        </View>
        <View style={styles.noticeCard}>
          <Text style={styles.noticeLabel}>Push / SMS</Text>
          <Text style={styles.noticeBody}>“Return request received. Staff will guide pickup/drop.”</Text>
        </View>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Return to history</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  subtitle: { marginTop: 5, color: "rgba(255,255,255,0.58)", fontSize: 12 },
  content: { padding: 16 },
  card: {
    minHeight: 190,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { marginTop: 8, color: colors.primary, fontSize: 15, fontWeight: "800" },
  body: { marginTop: 8, color: "#526477", fontSize: 12, textAlign: "center", fontFamily: "monospace" },
  badge: {
    marginTop: 13,
    color: "#E11D48",
    fontSize: 10,
    fontWeight: "800",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FECDD3",
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  noticeCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noticeLabel: { color: "#526477", fontSize: 11, fontFamily: "monospace" },
  noticeBody: { marginTop: 6, color: colors.primary, fontSize: 12, lineHeight: 18 },
  backButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
});
