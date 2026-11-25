import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import {
  authorizePackageCollector,
  revokePackageCollector,
} from "@/features/authorized-collector/services/packageConnectApi";
import {
  arrivalPhotoRequestHeaders,
  damagePhotoRequestHeaders,
  getResidentPackageDetail,
  refreshArrivalPhotoUrl,
  refreshDamagePhotoUrl,
  type ResidentPackageDetail,
} from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ResidentStackParamList, "PackageDetail">;
type Nav = NativeStackNavigationProp<ResidentStackParamList, "PackageDetail">;

type PhotoBlockProps = {
  title: string;
  url?: string;
  headers?: Record<string, string>;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  onError: () => void;
  note?: string;
};

function PhotoBlock({ title, url, headers, failed, retrying, onRetry, onError, note }: PhotoBlockProps) {
  return (
    <View style={styles.damageSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {url && !failed ? (
          <Image
            source={{ uri: url, headers }}
            style={styles.photo}
            resizeMode="cover"
            onError={onError}
          />
        ) : (
          <View style={[styles.photo, styles.placeholder]}>
            <Ionicons name="image-outline" size={27} color="#8A97A6" />
            <Text style={styles.placeholderText}>Photo unavailable</Text>
            <Pressable onPress={onRetry} disabled={retrying} style={styles.retry}>
              <Text style={styles.retryText}>{retrying ? "Retrying…" : "Retry photo"}</Text>
            </Pressable>
          </View>
        )}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

export function ResidentPackageDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { pkg } = route.params;
  const [detail, setDetail] = useState<ResidentPackageDetail | null>(null);
  const [arrivalUrl, setArrivalUrl] = useState<string | undefined>();
  const [damageUrl, setDamageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [arrivalFailed, setArrivalFailed] = useState(false);
  const [damageFailed, setDamageFailed] = useState(false);
  const [arrivalHeaders, setArrivalHeaders] = useState<Record<string, string> | undefined>();
  const [damageHeaders, setDamageHeaders] = useState<Record<string, string> | undefined>();
  const [retryingArrival, setRetryingArrival] = useState(false);
  const [retryingDamage, setRetryingDamage] = useState(false);
  const [collectorName, setCollectorName] = useState("");
  const [collectorPhone, setCollectorPhone] = useState("");
  const [collectorNote, setCollectorNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [residentId, setResidentId] = useState<string | null>(null);

  const reloadDetail = useCallback(async (ownerId: string) => {
    const result = await getResidentPackageDetail(ownerId, pkg.id);
    setDetail(result);
    setArrivalUrl(result.arrivalPhotoUrl);
    setDamageUrl(result.damagePhotoUrl);
    setArrivalHeaders(
      result.arrivalPhotoUrl ? await arrivalPhotoRequestHeaders(result.arrivalPhotoUrl) : undefined,
    );
    setDamageHeaders(
      result.damagePhotoUrl ? await damagePhotoRequestHeaders(result.damagePhotoUrl) : undefined,
    );
    setArrivalFailed(false);
    setDamageFailed(Boolean(result.isDamaged && !result.damagePhotoUrl));
    setCollectorName(result.authorizedCollectorName ?? "");
    setCollectorPhone(result.authorizedCollectorPhone ?? "");
    setCollectorNote(result.authorizedCollectorNote ?? "");
  }, [pkg.id]);

  useEffect(() => {
    let active = true;
    void getResidentSession().then(async (session) => {
      if (!session) {
        if (active) {
          setDetail(pkg as ResidentPackageDetail);
          setArrivalUrl(pkg.arrivalPhotoUrl);
          setDamageUrl(pkg.damagePhotoUrl);
          setArrivalHeaders(pkg.arrivalPhotoUrl ? await arrivalPhotoRequestHeaders(pkg.arrivalPhotoUrl) : undefined);
          setDamageHeaders(pkg.damagePhotoUrl ? await damagePhotoRequestHeaders(pkg.damagePhotoUrl) : undefined);
          setArrivalFailed(false);
          setDamageFailed(Boolean(pkg.isDamaged && !pkg.damagePhotoUrl));
          setCollectorName(pkg.authorizedCollectorName ?? "");
          setCollectorPhone(pkg.authorizedCollectorPhone ?? "");
          setCollectorNote(pkg.authorizedCollectorNote ?? "");
          setLoading(false);
        }
        return;
      }
      setResidentId(session.residentId);
      try {
        if (!active) return;
        await reloadDetail(session.residentId);
      } catch {
        if (active) {
          setDetail(pkg as ResidentPackageDetail);
          setArrivalUrl(pkg.arrivalPhotoUrl);
          setDamageUrl(pkg.damagePhotoUrl);
          setArrivalHeaders(pkg.arrivalPhotoUrl ? await arrivalPhotoRequestHeaders(pkg.arrivalPhotoUrl) : undefined);
          setDamageHeaders(pkg.damagePhotoUrl ? await damagePhotoRequestHeaders(pkg.damagePhotoUrl) : undefined);
          setDamageFailed(Boolean(pkg.isDamaged && !pkg.damagePhotoUrl));
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [pkg, reloadDetail]);

  const retryArrival = useCallback(async () => {
    setRetryingArrival(true);
    try {
      const session = await getResidentSession();
      if (!session) throw new Error("Please sign in again to load the arrival photo.");
      const freshUrl = await refreshArrivalPhotoUrl(session.residentId, pkg.id);
      setArrivalUrl(freshUrl);
      setArrivalHeaders(await arrivalPhotoRequestHeaders(freshUrl));
      setArrivalFailed(false);
    } catch {
      setArrivalFailed(true);
    } finally {
      setRetryingArrival(false);
    }
  }, [pkg.id]);

  const retryDamage = useCallback(async () => {
    setRetryingDamage(true);
    try {
      const session = await getResidentSession();
      if (!session) throw new Error("Please sign in again to load the damage photo.");
      const freshUrl = await refreshDamagePhotoUrl(session.residentId, pkg.id);
      setDamageUrl(freshUrl);
      setDamageHeaders(await damagePhotoRequestHeaders(freshUrl));
      setDamageFailed(false);
    } catch {
      setDamageFailed(true);
    } finally {
      setRetryingDamage(false);
    }
  }, [pkg.id]);

  const current = detail ?? pkg;
  const showArrival =
    Boolean(arrivalUrl) || arrivalFailed || Boolean(current.hasArrivalPhoto);
  const showDamage = Boolean(current.isDamaged);
  const hasCollector = Boolean(current.authorizedCollectorName);
  const canAct = Boolean(residentId) && !actionBusy;

  async function onAuthorizeCollector() {
    if (!residentId) return;
    const name = collectorName.trim();
    if (!name) {
      setActionError("Enter the collector's name.");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      await authorizePackageCollector(residentId, pkg.id, {
        collectorName: name,
        collectorPhone: collectorPhone.trim() || undefined,
        note: collectorNote.trim() || undefined,
      });
      await reloadDetail(residentId);
      Alert.alert("Collector authorized", `${name} can collect this package at the hub.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to authorize collector.");
    } finally {
      setActionBusy(false);
    }
  }

  async function onRevokeCollector() {
    if (!residentId) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await revokePackageCollector(residentId, pkg.id);
      setCollectorName("");
      setCollectorPhone("");
      setCollectorNote("");
      await reloadDetail(residentId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to revoke collector.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
        <View style={styles.hero}>
          <Text style={styles.tracking}>{pkg.pkgNumber || pkg.tracking}</Text>
          <Text style={styles.meta}>
            {pkg.courier} · {pkg.tracking}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.status}>
            {current.status ?? "Shelved"}
            {current.shelfCode ? ` · ${current.shelfCode}` : ""}
          </Text>
          {current.isDamaged ? <Text style={styles.damaged}>Damaged on arrival</Text> : null}
          {hasCollector ? <Text style={styles.collectorBadge}>Authorized collector</Text> : null}
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}

        {!loading && showArrival ? (
          <PhotoBlock
            title="Arrival photo"
            url={arrivalUrl}
            headers={arrivalHeaders}
            failed={arrivalFailed || !arrivalUrl}
            retrying={retryingArrival}
            onRetry={() => void retryArrival()}
            onError={() => setArrivalFailed(true)}
          />
        ) : null}

        {!loading && showDamage ? (
          <PhotoBlock
            title="Hub intake note"
            url={damageUrl}
            headers={damageHeaders}
            failed={damageFailed || !damageUrl}
            retrying={retryingDamage}
            onRetry={() => void retryDamage()}
            onError={() => setDamageFailed(true)}
            note={current.damageNote}
          />
        ) : null}

        {!loading ? (
          <View style={styles.connectSection}>
            <Text style={styles.sectionTitle}>Authorize collector</Text>
            <View style={styles.card}>
              <Text style={styles.connectBody}>
                Going out of town or busy? Let a neighbour, family member, or guest collect this package at the hub on your behalf.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Collector full name"
                placeholderTextColor="#94A3B8"
                value={collectorName}
                onChangeText={setCollectorName}
                editable={canAct}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone (optional)"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={collectorPhone}
                onChangeText={setCollectorPhone}
                editable={canAct}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Note for staff (optional)"
                placeholderTextColor="#94A3B8"
                value={collectorNote}
                onChangeText={setCollectorNote}
                editable={canAct}
                multiline
              />
              {hasCollector ? (
                <Text style={styles.collectorActive}>
                  Active: {current.authorizedCollectorName}
                  {current.authorizedCollectorPhone ? ` · ${current.authorizedCollectorPhone}` : ""}
                </Text>
              ) : null}
              <Pressable
                style={[styles.primaryButton, !canAct && styles.buttonDisabled]}
                disabled={!canAct}
                onPress={() => void onAuthorizeCollector()}
              >
                <Text style={styles.primaryButtonText}>
                  {hasCollector ? "Update authorized collector" : "Authorize collector"}
                </Text>
              </Pressable>
              {hasCollector ? (
                <Pressable
                  style={[styles.secondaryButton, !canAct && styles.buttonDisabled]}
                  disabled={!canAct}
                  onPress={() => void onRevokeCollector()}
                >
                  <Text style={styles.secondaryButtonText}>Revoke collector</Text>
                </Pressable>
              ) : null}
            </View>
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          </View>
        ) : null}

        <Pressable
          style={styles.deliveryButton}
          onPress={() => navigation.navigate("DeliveryPreference", { pkg: current })}
        >
          <Text style={styles.deliveryText}>Schedule door delivery</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 },
  tracking: { color: "#fff", fontSize: 17, fontWeight: "800" },
  meta: { color: "#C3D2E0", fontSize: 11, marginTop: 5 },
  statusRow: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  status: {
    color: "#1551BA",
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "700",
  },
  damaged: {
    color: "#A65B00",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "700",
  },
  collectorBadge: {
    color: "#047857",
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "700",
  },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  loading: { marginTop: 20 },
  damageSection: { marginTop: 16 },
  connectSection: { marginTop: 16 },
  sectionTitle: {
    marginHorizontal: 16,
    marginBottom: 1,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  connectBody: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  inputMultiline: { minHeight: 64, textAlignVertical: "top" },
  collectorActive: {
    color: "#166534",
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#B91C1C", fontWeight: "700", fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
  actionError: {
    marginHorizontal: 16,
    marginTop: 8,
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "600",
  },
  photo: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#E7EBEF", marginBottom: 8 },
  placeholder: { alignItems: "center", justifyContent: "center", padding: 6 },
  placeholderText: { color: "#697586", fontSize: 9, textAlign: "center", marginTop: 2 },
  retry: { paddingVertical: 6, paddingHorizontal: 8 },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6, fontFamily: "monospace" },
  deliveryButton: {
    marginHorizontal: 16,
    marginTop: 10,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  deliveryText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
});
