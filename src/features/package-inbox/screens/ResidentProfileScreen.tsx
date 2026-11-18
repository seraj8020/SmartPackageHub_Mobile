import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ResidentSessionState } from "@/features/authentication/models/auth.types";
import { getResidentProfile } from "@/features/authentication/services/residentAuthApi";
import {
  getResidentSession,
  setResidentSession,
} from "@/features/authentication/services/sessionStorage";
import { getSocieties } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import { societyLocationLabel } from "@/shared/utils/greeting";

const FEATURES = [
  { label: "OTP Pickup", guest: false, basic: true, premium: true },
  { label: "Delivery History", guest: false, basic: true, premium: true },
  { label: "Flat Delivery", guest: false, basic: false, premium: true },
  { label: "Vacation Hold", guest: false, basic: true, premium: true },
  { label: "Push Notifications", guest: false, basic: true, premium: true },
  { label: "Priority Support", guest: false, basic: false, premium: true },
] as const;

function initialsFrom(fullName?: string) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ResidentProfileScreen() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ResidentSessionState | null>(null);
  const [societyName, setSocietyName] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await getResidentSession();
      if (!stored) {
        setSession(null);
        setSocietyName("");
        return;
      }

      let nextSession = stored;
      try {
        const profile = await getResidentProfile(stored.residentId);
        const fullName = profile.fullName?.trim() || stored.fullName;
        const towerWing = profile.towerWing?.trim() || undefined;
        const flatNumber = profile.flatNumber?.trim() || undefined;
        if (
          fullName !== stored.fullName ||
          towerWing !== stored.towerWing ||
          flatNumber !== stored.flatNumber
        ) {
          nextSession = { ...stored, fullName, towerWing, flatNumber };
          await setResidentSession(nextSession);
        }
      } catch {
        // Keep session values if profile cannot be loaded.
      }

      setSession(nextSession);
      const societies = await getSocieties().catch(() => []);
      const match = societies.find((item) => item.id === nextSession.societyId);
      setSocietyName(match?.name ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const displayName = isGuest ? "Guest User" : session?.fullName?.trim() || "Resident";
  const displayLocation = isGuest
    ? "Limited access"
    : societyLocationLabel(societyName, session?.towerWing, session?.flatNumber);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 24 + Math.max(insets.bottom, 0),
          paddingLeft: Math.max(insets.left, 0),
          paddingRight: Math.max(insets.right, 0),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {isGuest ? "G" : initialsFrom(session?.fullName)}
                </Text>
              </View>
              <View style={styles.heroText}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.location} numberOfLines={1}>
                  {displayLocation}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.membershipWrap}>
          <View style={[styles.membershipCard, isGuest ? styles.membershipGuest : styles.membershipPremium]}>
            <View style={styles.membershipText}>
              <Text style={styles.membershipEyebrow}>
                {isGuest ? "Guest Mode" : "Premium Member"}
              </Text>
              <Text style={styles.membershipTitle}>
                {isGuest ? "Sign up for full access" : "SPH Premium"}
              </Text>
            </View>
            <Ionicons
              name="star"
              size={20}
              color="#FDE047"
              style={{ opacity: isGuest ? 0.45 : 1 }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Access</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.featureLabel, styles.headerLabel]} />
              {(["Guest", "Basic", "Premium"] as const).map((tier) => (
                <Text key={tier} style={styles.tierHeader}>
                  {tier}
                </Text>
              ))}
            </View>
            {FEATURES.map((feature) => (
              <View key={feature.label} style={styles.tableRow}>
                <Text style={styles.featureLabel}>{feature.label}</Text>
                {[feature.guest, feature.basic, feature.premium].map((ok, index) => (
                  <View key={`${feature.label}-${index}`} style={styles.cell}>
                    {ok ? (
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    ) : (
                      <Text style={styles.cross}>✕</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={styles.switchButton}
            onPress={() => setIsGuest((current) => !current)}
          >
            <Text style={styles.switchButtonText}>
              {isGuest ? "→ Switch to Registered View" : "→ Switch to Guest View"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 96,
    justifyContent: "center",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  heroText: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontWeight: "700", fontSize: 16 },
  location: { marginTop: 2, color: "rgba(255,255,255,0.5)", fontSize: 12 },
  membershipWrap: { paddingHorizontal: 16, marginTop: -20 },
  membershipCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  membershipGuest: { backgroundColor: "#6B7280" },
  membershipPremium: { backgroundColor: "#0EA5E9" },
  membershipText: { flex: 1, minWidth: 0, paddingRight: 8 },
  membershipEyebrow: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  membershipTitle: { marginTop: 2, color: "#fff", fontSize: 16, fontWeight: "700" },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: {
    marginBottom: 8,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  table: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    backgroundColor: colors.surface,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tableHeader: { paddingVertical: 8 },
  featureLabel: { flex: 1.2, color: "#374151", fontSize: 12 },
  headerLabel: { color: "transparent" },
  tierHeader: {
    flex: 1,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cell: { flex: 1, alignItems: "center" },
  cross: { color: "#D1D5DB", fontSize: 12, fontWeight: "700" },
  switchButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  switchButtonText: { color: "#6B7280", fontSize: 12, fontWeight: "700" },
});
