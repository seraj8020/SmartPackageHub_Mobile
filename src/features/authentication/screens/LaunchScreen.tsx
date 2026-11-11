import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Launch">;

export function LaunchScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Ionicons name="cube-outline" size={26} color="#fff" />
        </View>
        <Text style={styles.brand}>Smart Package Hub</Text>
        <Text style={styles.heroHint}>Choose how you want to sign in</Text>
      </View>

      <View style={styles.cards}>
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("ResidentLogin")}
        >
          <View style={[styles.iconWrap, styles.iconResident]}>
            <Ionicons name="person-outline" size={22} color="#0EA5E9" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Resident login</Text>
            <Text style={styles.cardSubtitle}>
              Sign in with mobile OTP to track packages
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("StaffLogin")}
        >
          <View style={[styles.iconWrap, styles.iconStaff]}>
            <Ionicons name="business-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Staff login</Text>
            <Text style={styles.cardSubtitle}>
              Username and password for hub operations
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
    alignItems: "center",
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  brand: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  heroHint: {
    marginTop: 4,
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
  },
  cards: { flex: 1, paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconResident: { backgroundColor: "rgba(14,165,233,0.1)" },
  iconStaff: { backgroundColor: "rgba(28,61,90,0.1)" },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.primary },
  cardSubtitle: { marginTop: 2, fontSize: 11, color: colors.textMuted },
});
