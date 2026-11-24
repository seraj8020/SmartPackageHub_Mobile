import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  arrivalPhotoRequestHeaders,
  residentArrivalPhotoProxyUrl,
  type HubPackage,
} from "@/shared/services/packageApi";
import { colors } from "@/shared/theme/colors";
import { formatDisplayTimestamp } from "@/shared/utils/formatDisplayTimestamp";
import {
  shelfCollectLabel,
  shelfLocationDetail,
} from "@/features/package-inbox/utils/shelfLocationLabel";

type Props = {
  pkg: HubPackage;
  residentId: string;
  onPress: () => void;
};

function preferenceChip(pkg: HubPackage): { text: string; styleKey: "violet" | "green" | "amber" } | null {
  if (pkg.preferredDeliveryMethod === "CounterPickup") {
    return { text: "Counter pickup", styleKey: "violet" };
  }
  if (pkg.preferredDeliveryMethod === "DoorDelivery" && pkg.deliverySlotLabel) {
    return {
      text:
        pkg.deliverySlotStatus === "default"
          ? `Door delivery · default ${pkg.deliverySlotLabel}`
          : `Door delivery · ${pkg.deliverySlotLabel}`,
      styleKey: pkg.deliverySlotStatus === "default" ? "amber" : "green",
    };
  }
  if (pkg.deliverySlotLabel) {
    return {
      text:
        pkg.deliverySlotStatus === "default"
          ? `Default door ${pkg.deliverySlotLabel}`
          : `Door ${pkg.deliverySlotLabel}`,
      styleKey: pkg.deliverySlotStatus === "default" ? "amber" : "green",
    };
  }
  return null;
}

export function InboxPackageCard({ pkg, residentId, onPress }: Props) {
  const pref = preferenceChip(pkg);
  const collect = shelfCollectLabel(pkg);
  const shelfDetail = shelfLocationDetail(pkg);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>();
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPhotoFailed(false);
    // Prefer signed URL from detail-shaped payloads; otherwise use authenticated proxy.
    const url =
      pkg.arrivalPhotoUrl ||
      (residentId && pkg.id ? residentArrivalPhotoProxyUrl(residentId, pkg.id) : undefined);
    if (!url) {
      setPhotoUrl(undefined);
      setPhotoHeaders(undefined);
      return;
    }
    void (async () => {
      const headers = await arrivalPhotoRequestHeaders(url);
      if (!active) return;
      setPhotoUrl(url);
      setPhotoHeaders(headers);
    })();
    return () => {
      active = false;
    };
  }, [pkg.arrivalPhotoUrl, pkg.id, residentId]);

  const title =
    pkg.pkgNumber || pkg.tracking || pkg.trackingNumber || pkg.recipientName || "Package";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {photoUrl && !photoFailed ? (
          <Image
            source={{ uri: photoUrl, headers: photoHeaders }}
            style={styles.thumb}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="cube-outline" size={28} color="#9CA3AF" />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.courier} numberOfLines={1}>
            {pkg.courier ?? "Courier"}
          </Text>
          <Text style={styles.receivedAt}>{formatDisplayTimestamp(pkg.receivedAt)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {(pkg.category || pkg.weight) ? (
          <Text style={styles.meta} numberOfLines={1}>
            {pkg.category}
            {pkg.weight ? ` · ${pkg.weight}` : ""}
          </Text>
        ) : null}

        {collect ? (
          <View style={styles.shelfBlock}>
            <Text style={styles.shelfCollect}>{collect}</Text>
            {shelfDetail ? <Text style={styles.shelfDetail}>{shelfDetail}</Text> : null}
          </View>
        ) : null}

        <View style={styles.chips}>
          {pkg.isDamaged ? <Text style={styles.damageChip}>Damaged</Text> : null}
          {pkg.isCod ? (
            <Text style={styles.codChip}>
              COD
              {pkg.codAmount != null ? ` ₹${pkg.codAmount}` : ""}
            </Text>
          ) : null}
          {pref ? (
            <Text
              style={[
                styles.prefChip,
                pref.styleKey === "violet"
                  ? styles.prefViolet
                  : pref.styleKey === "amber"
                    ? styles.prefAmber
                    : styles.prefGreen,
              ]}
            >
              {pref.text}
            </Text>
          ) : (
            <Text style={styles.bookChip}>Book delivery</Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  thumbWrap: { width: 72, height: 72 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  courier: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.primary },
  receivedAt: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },
  title: { marginTop: 2, fontSize: 14, fontWeight: "800", color: colors.text },
  meta: { marginTop: 2, fontSize: 11, color: "#6B7280" },
  shelfBlock: { marginTop: 4 },
  shelfCollect: { fontSize: 11, fontWeight: "700", color: "#374151" },
  shelfDetail: { marginTop: 1, fontSize: 10, color: "#9CA3AF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  damageChip: {
    fontSize: 10,
    fontWeight: "800",
    color: "#991B1B",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  codChip: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  bookChip: {
    fontSize: 10,
    fontWeight: "800",
    color: "#065F46",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  prefChip: {
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  prefViolet: { color: "#5B21B6", backgroundColor: "#F5F3FF" },
  prefAmber: { color: "#92400E", backgroundColor: "#FFFBEB" },
  prefGreen: { color: "#065F46", backgroundColor: "#ECFDF5" },
  chevron: { marginLeft: 2 },
});
