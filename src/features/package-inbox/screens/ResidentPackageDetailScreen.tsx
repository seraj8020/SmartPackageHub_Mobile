import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import { getReturnRequestEligibility } from "@/features/package-inbox/utils/residentReturnEligibility";
import {
  arrivalPhotoRequestHeaders,
  damagePhotoRequestHeaders,
  getResidentPackageDetail,
  refreshArrivalPhotoUrl,
  refreshDamagePhotoUrl,
  requestPackageReturn,
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
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitted, setReturnSubmitted] = useState(false);

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
          setLoading(false);
        }
        return;
      }
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
  const returnEligibility = useMemo(
    () =>
      getReturnRequestEligibility({
        status: returnSubmitted ? "ReturnRequested" : current.status,
        deliveredAt: current.deliveredAt,
        treatBlankAsDelivered: false,
      }),
    [current.deliveredAt, current.status, returnSubmitted],
  );
  const isDeliveredLifecycle =
    (current.status ?? "").trim().toLowerCase() === "delivered" || returnSubmitted;

  const submitReturn = useCallback(async () => {
    if (requestingReturn || !returnEligibility.canRequest) return;
    setRequestingReturn(true);
    setReturnError(null);
    try {
      const session = await getResidentSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      await requestPackageReturn(pkg.id, session.residentId, "DamagedInside");
      setDetail((prev) =>
        prev ? { ...prev, status: "ReturnRequested" } : ({ ...pkg, status: "ReturnRequested", isDamaged: Boolean(pkg.isDamaged) } as ResidentPackageDetail),
      );
      setReturnSubmitted(true);
    } catch (cause) {
      setReturnError(cause instanceof Error ? cause.message : "Unable to request return.");
    } finally {
      setRequestingReturn(false);
    }
  }, [pkg, requestingReturn, returnEligibility.canRequest]);

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
            {returnSubmitted ? "ReturnRequested" : current.status ?? "Shelved"}
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

        {!loading && hasCollector ? (
          <View style={styles.collectorSummary}>
            <Text style={styles.sectionTitle}>Authorized collector</Text>
            <View style={styles.card}>
              <Text style={styles.collectorActive}>
                {current.authorizedCollectorName}
                {current.authorizedCollectorPhone ? ` · ${current.authorizedCollectorPhone}` : ""}
              </Text>
              {current.authorizedCollectorNote ? (
                <Text style={styles.note}>{current.authorizedCollectorNote}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {!loading && isDeliveredLifecycle ? (
          <View style={styles.returnSection}>
            <Text style={styles.sectionTitle}>Return</Text>
            <View style={styles.card}>
              <Text style={[styles.returnMessage, returnEligibility.alreadyRequested && styles.returnRequested]}>
                {returnEligibility.message}
              </Text>
              {returnEligibility.canRequest ? (
                <Pressable
                  style={[styles.primaryAction, styles.returnAction, requestingReturn && styles.actionDisabled]}
                  disabled={requestingReturn}
                  onPress={() => void submitReturn()}
                >
                  <Text style={styles.primaryActionText}>
                    {requestingReturn ? "Requesting…" : "Request return"}
                  </Text>
                </Pressable>
              ) : null}
              {returnError ? <Text style={styles.returnError}>{returnError}</Text> : null}
              {returnSubmitted ? (
                <Text style={styles.returnSuccess}>Return request received. Staff will guide pickup/drop.</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {!isDeliveredLifecycle ? (
          <>
            <Pressable
              style={styles.primaryAction}
              onPress={() => navigation.navigate("AuthorizeCollector", { pkg: current })}
            >
              <Text style={styles.primaryActionText}>
                {hasCollector ? "Manage authorized collector" : "Authorize someone to collect"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.deliveryButton}
              onPress={() => navigation.navigate("DeliveryPreference", { pkg: current })}
            >
              <Text style={styles.deliveryText}>Schedule door delivery</Text>
            </Pressable>
          </>
        ) : null}
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
    flexWrap: "wrap",
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
  collectorSummary: { marginTop: 16 },
  sectionTitle: {
    marginHorizontal: 16,
    marginBottom: 1,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  collectorActive: { color: "#166534", fontSize: 13, fontWeight: "700" },
  photo: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#E7EBEF", marginBottom: 8 },
  placeholder: { alignItems: "center", justifyContent: "center", padding: 6 },
  placeholderText: { color: "#697586", fontSize: 9, textAlign: "center", marginTop: 2 },
  retry: { paddingVertical: 6, paddingHorizontal: 8 },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  primaryAction: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.primary,
  },
  primaryActionText: { color: "#fff", fontWeight: "800", fontSize: 14 },
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
  returnSection: { marginTop: 16 },
  returnMessage: { color: "#526477", fontSize: 12, lineHeight: 17 },
  returnRequested: { color: "#E11D48", fontWeight: "700" },
  returnAction: { marginHorizontal: 0, marginTop: 12 },
  actionDisabled: { opacity: 0.65 },
  returnError: { marginTop: 10, color: "#B91C1C", fontSize: 12 },
  returnSuccess: { marginTop: 10, color: "#166534", fontSize: 12, lineHeight: 17, fontWeight: "600" },
});
