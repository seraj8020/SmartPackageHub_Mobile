import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getStaffSession } from "@/features/authentication/services/sessionStorage";
import type { StaffPackageReturn } from "@/features/package-returns/models/packageReturn.types";
import { getSocietyPackageReturns } from "@/features/package-returns/services/packageReturnApi";
import { formatPackageReturnReason } from "@/features/package-returns/utils/returnReasonLabels";
import { API, authTokenHeader } from "@/shared/services/apiClient";
import { colors } from "@/shared/theme/colors";
import { formatDisplayTimestamp } from "@/shared/utils/formatDisplayTimestamp";

function statusOf(request: StaffPackageReturn): string {
  return request.status.replace(/^Return/, "").replace(/([a-z])([A-Z])/g, "$1 $2") || "Requested";
}

export function StaffReturnsScreen({ embedded = false }: { embedded?: boolean }) {
  const [societyId, setSocietyId] = useState("");
  const [returns, setReturns] = useState<StaffPackageReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffPackageReturn | null>(null);
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string>>({});
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void authTokenHeader().then(setPhotoHeaders).catch(() => setPhotoHeaders({}));
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) {
      setLoading(false);
      setError("No society is linked to this staff account.");
      return;
    }
    setError(null);
    try {
      setReturns(await getSocietyPackageReturns(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load return requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void getStaffSession().then((session) => {
      if (!active) return;
      if (!session) {
        setError("Staff session has expired. Please sign in again.");
        setLoading(false);
        return;
      }
      const id = session.primarySocietyId ?? session.societyIds[0] ?? "";
      setSocietyId(id);
      void load(id);
    }).catch(() => {
      if (active) {
        setError("Unable to read staff session.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [load]));

  if (selected) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelected(null)} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to returns">
            <Ionicons name="arrow-back" size={19} color="#fff" />
            <Text style={styles.backText}>Return packages</Text>
          </Pressable>
          <Text style={styles.title}>Return request</Text>
          <Text style={styles.subtitle}>{selected.residentName || "Resident"}{selected.unit ? ` · ${selected.unit}` : ""}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.detailCard}>
            <View style={styles.detailTop}>
              <Text style={styles.sectionTitle}>Reason</Text>
              <Text style={styles.statusBadge}>{statusOf(selected)}</Text>
            </View>
            <Text style={styles.reason}>{formatPackageReturnReason(selected.reason)}</Text>
            {selected.note ? <Text style={styles.note}>{selected.note}</Text> : null}
          </View>
          <Text style={styles.sectionLabel}>RESIDENT PHOTOS</Text>
          {selected.photos.length > 0 ? (
            <View style={styles.photos}>
              {selected.photos.map((photo) => (
                <View key={photo.id} style={styles.photoFrame}>
                  {failedPhotos[photo.id] ? (
                    <View style={styles.photoFallback}><Text style={styles.photoFallbackText}>IMG</Text></View>
                  ) : (
                    <Image
                      source={{
                        uri: `${API}/residents/${encodeURIComponent(selected.residentId)}/packages/${encodeURIComponent(selected.packageId)}/return-photos/${encodeURIComponent(photo.id)}`,
                        headers: photoHeaders,
                      }}
                      style={styles.photo}
                      resizeMode="cover"
                      onError={() => setFailedPhotos((previous) => ({ ...previous, [photo.id]: true }))}
                      accessibilityLabel="Resident return photo"
                    />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noPhotos}>No resident photos attached.</Text>
          )}
          <Text style={styles.sectionLabel}>HUB INTAKE DAMAGE (IF ANY)</Text>
          <View style={styles.detailCard}>
            <Text style={styles.reason}>{selected.hubIntakeDamageNote || (selected.hasHubIntakeDamage ? "Damage reported at intake" : "None for this package")}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {!embedded ? <View style={styles.header}>
        <Text style={styles.eyebrow}>STAFF RETURNS QUEUE</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Returns</Text>
          <Text style={styles.count}>{returns.length} open</Text>
        </View>
        <Text style={styles.subtitle}>Resident drop-off / collection</Text>
      </View> : null}
      {loading && returns.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 28 }} />
      ) : error && returns.length === 0 ? (
        <View style={styles.stateBox}>
          <Ionicons name="cloud-offline-outline" size={25} color="#9CA3AF" />
          <Text style={styles.stateTitle}>Couldn’t load returns</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); void load(societyId); }} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={returns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(societyId); }} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={embedded ? styles.embeddedCount : styles.eyebrow}>
                {embedded ? `Return packages (${returns.length})` : "STAFF RETURNS QUEUE"}
              </Text>
              {!embedded ? <Text style={styles.count}>{returns.length} open</Text> : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.stateBox}>
              <Ionicons name="return-down-back-outline" size={25} color="#9CA3AF" />
              <Text style={styles.stateTitle}>No open return requests</Text>
              <Text style={styles.stateBody}>New resident requests for this society will appear here.</Text>
              {error ? <Text style={styles.errorInline}>{error}</Text> : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setSelected(item)} accessibilityRole="button" accessibilityLabel={`View return request for ${item.residentName || "resident"}`}>
              <View style={styles.cardHead}>
                <View style={styles.residentBlock}>
                <Text style={styles.resident} numberOfLines={1}>{item.residentName || "Resident"}{item.unit ? ` · ${item.unit}` : ""}</Text>
                  <Text style={styles.packageLine} numberOfLines={1}>{item.pkgNumber || item.packageId} · {item.courierPartner || "Courier"}</Text>
                </View>
                <Text style={styles.statusBadge}>{statusOf(item)}</Text>
              </View>
              <Text style={styles.reasonLine} numberOfLines={1}>{formatPackageReturnReason(item.reason)}</Text>
              <View style={styles.cardFoot}>
                <Text style={styles.requested}>{item.requestedAtUtc ? `Requested ${formatDisplayTimestamp(item.requestedAtUtc)}` : "Request time unavailable"}</Text>
                <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingTop: 0, paddingBottom: 13 },
  eyebrow: { color: "rgba(255,255,255,0.64)", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  count: { color: colors.primary, backgroundColor: "#CFFAFE", overflow: "hidden", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, fontSize: 10, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.68)", fontSize: 12, marginTop: 5 },
  list: { padding: 14, paddingBottom: 30, flexGrow: 1 },
  detailContent: { paddingBottom: 28 },
  card: { backgroundColor: colors.surface, borderColor: "#E1E6EC", borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  residentBlock: { flex: 1, minWidth: 0 },
  resident: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  packageLine: { color: "#718096", fontSize: 10, marginTop: 5 },
  statusBadge: { alignSelf: "flex-start", color: "#C81E4B", backgroundColor: "#FFF1F2", borderColor: "#FECDD3", borderWidth: 1, overflow: "hidden", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: "800" },
  reasonLine: { color: "#526174", fontSize: 11, marginTop: 9 },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  requested: { color: "#718096", fontSize: 10 },
  stateBox: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 44 },
  stateTitle: { marginTop: 9, fontSize: 14, fontWeight: "800", color: "#4B5563" },
  stateBody: { marginTop: 5, fontSize: 12, color: "#8792A2", textAlign: "center", lineHeight: 18 },
  retry: { marginTop: 13, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: colors.primary, borderRadius: 9 },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  errorInline: { color: colors.danger, marginTop: 9, fontSize: 11, textAlign: "center" },
  back: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 13 },
  backText: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  detailCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: "#E1E6EC", borderRadius: 14, padding: 14, marginHorizontal: 14, marginTop: 14 },
  detailTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 14, color: colors.primary, fontWeight: "800" },
  reason: { color: "#65758B", fontSize: 12, marginTop: 10 },
  note: { color: "#65758B", fontSize: 12, marginTop: 8 },
  sectionLabel: { color: colors.primary, fontWeight: "900", fontSize: 10, letterSpacing: 1, marginTop: 19, marginHorizontal: 18 },
  detailMeta: { color: "#718096", fontSize: 11, marginTop: 8 },
  listHeader: { paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  embeddedCount: { fontSize: 11, fontWeight: "800", color: colors.primary },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 14, marginTop: 10 },
  photoFrame: { width: 86, height: 86, borderRadius: 10, overflow: "hidden", backgroundColor: "#E8EDF2" },
  photo: { width: "100%", height: "100%" },
  photoFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#E8EDF2" },
  photoFallbackText: { color: "#64748B", fontSize: 10, fontWeight: "800" },
  noPhotos: { color: "#718096", fontSize: 11, marginHorizontal: 18, marginTop: 8 },
});
