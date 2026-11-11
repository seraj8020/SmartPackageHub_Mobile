import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";

export function StaffTabPlaceholderScreen({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.primary, marginBottom: 8 },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
});
