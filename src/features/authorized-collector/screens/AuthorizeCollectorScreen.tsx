import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import {
  authorizePackageCollector,
  revokePackageCollector,
} from "@/features/authorized-collector/services/packageConnectApi";
import { getResidentPackageDetail, type HubPackage } from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ResidentStackParamList, "AuthorizeCollector">;

export function AuthorizeCollectorScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { pkg } = route.params;
  const [residentId, setResidentId] = useState<string | null>(null);
  const [current, setCurrent] = useState<HubPackage>(pkg);
  const [collectorName, setCollectorName] = useState(pkg.authorizedCollectorName ?? "");
  const [collectorPhone, setCollectorPhone] = useState(pkg.authorizedCollectorPhone ?? "");
  const [collectorNote, setCollectorNote] = useState(pkg.authorizedCollectorNote ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (ownerId: string, packageId: string) => {
    const detail = await getResidentPackageDetail(ownerId, packageId);
    setCurrent(detail);
    setCollectorName(detail.authorizedCollectorName ?? "");
    setCollectorPhone(detail.authorizedCollectorPhone ?? "");
    setCollectorNote(detail.authorizedCollectorNote ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getResidentSession();
        if (!session) {
          if (active) {
            setError("Please sign in again.");
            setLoading(false);
          }
          return;
        }
        if (!active) return;
        setResidentId(session.residentId);
        await reload(session.residentId, pkg.id);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load package.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pkg.id, reload]);

  const hasCollector = Boolean(current.authorizedCollectorName);
  const canAct = Boolean(residentId) && !busy && !loading;

  async function onAuthorize() {
    if (!residentId) return;
    const name = collectorName.trim();
    if (!name) {
      setError("Enter the collector's full name.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await authorizePackageCollector(residentId, pkg.id, {
        collectorName: name,
        collectorPhone: collectorPhone.trim() || undefined,
        note: collectorNote.trim() || undefined,
      });
      await reload(residentId, pkg.id);
      setMessage(`${name} can collect this package at the hub.`);
      Alert.alert("Collector authorized", `${name} can collect this package at the hub.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authorize collector.");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke() {
    if (!residentId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await revokePackageCollector(residentId, pkg.id);
      setCollectorName("");
      setCollectorPhone("");
      setCollectorNote("");
      await reload(residentId, pkg.id);
      setMessage("Authorized collector removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke collector.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.pkgLabel}>Package</Text>
          <Text style={styles.pkgTitle}>{pkg.pkgNumber || pkg.tracking}</Text>
          <Text style={styles.pkgMeta}>
            {pkg.courier}
            {pkg.courierAwb ? ` · AWB ${pkg.courierAwb}` : ""}
          </Text>
        </View>

        <Text style={styles.intro}>
          Going out of town or busy? Authorize a neighbour, family member, or guest to collect this
          package at the hub on your behalf. Staff will see their name at handover.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.card}>
            {hasCollector ? (
              <View style={styles.activeBanner}>
                <Text style={styles.activeText}>
                  Active: {current.authorizedCollectorName}
                  {current.authorizedCollectorPhone
                    ? ` · ${current.authorizedCollectorPhone}`
                    : ""}
                </Text>
              </View>
            ) : (
              <View style={styles.inactiveBanner}>
                <Text style={styles.inactiveText}>No authorized collector yet.</Text>
              </View>
            )}

            <Text style={styles.label}>Collector full name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#94A3B8"
              value={collectorName}
              onChangeText={setCollectorName}
              editable={canAct}
            />

            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Mobile number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={collectorPhone}
              onChangeText={setCollectorPhone}
              editable={canAct}
            />

            <Text style={styles.label}>Note for staff (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Flat neighbour / relative / guest ID hint"
              placeholderTextColor="#94A3B8"
              value={collectorNote}
              onChangeText={setCollectorNote}
              editable={canAct}
              multiline
            />

            <Pressable
              style={[styles.primaryButton, !canAct && styles.disabled]}
              disabled={!canAct}
              onPress={() => void onAuthorize()}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {hasCollector ? "Update authorized collector" : "Authorize collector"}
                </Text>
              )}
            </Pressable>

            {hasCollector ? (
              <Pressable
                style={[styles.secondaryButton, !canAct && styles.disabled]}
                disabled={!canAct}
                onPress={() => void onRevoke()}
              >
                <Text style={styles.secondaryButtonText}>Revoke collector</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {message ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{message}</Text>
          </View>
        ) : null}

        <Pressable style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← Back to package</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  pkgLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pkgTitle: { color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 4 },
  pkgMeta: { color: "#C3D2E0", fontSize: 12, marginTop: 4 },
  intro: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  loader: { marginTop: 28 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  activeBanner: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 12,
  },
  activeText: { color: "#047857", fontSize: 12, fontWeight: "700" },
  inactiveBanner: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 12,
  },
  inactiveText: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  label: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#B91C1C", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
  errorBox: {
    marginTop: 12,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: "#B91C1C", fontSize: 12, fontWeight: "600" },
  successBox: {
    marginTop: 12,
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  successText: { color: "#047857", fontSize: 12, fontWeight: "600" },
  backLink: { marginTop: 18, alignItems: "center", paddingVertical: 8 },
  backLinkText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
