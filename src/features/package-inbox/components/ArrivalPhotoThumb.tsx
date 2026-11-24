import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  arrivalPhotoRequestHeaders,
  staffArrivalPhotoProxyUrl,
  type HubPackage,
} from "@/shared/services/packageApi";

type Props = {
  pkg: Pick<HubPackage, "id" | "hasArrivalPhoto" | "arrivalPhotoUrl">;
  size?: number;
};

/** Gated thumbnail — only requests image bytes when hasArrivalPhoto is true. */
export function ArrivalPhotoThumb({ pkg, size = 64 }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>();
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPhotoFailed(false);
    const url =
      pkg.arrivalPhotoUrl ||
      (pkg.hasArrivalPhoto && pkg.id ? staffArrivalPhotoProxyUrl(pkg.id) : undefined);
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
  }, [pkg.arrivalPhotoUrl, pkg.hasArrivalPhoto, pkg.id]);

  const box = { width: size, height: size, borderRadius: Math.max(8, Math.round(size * 0.14)) };

  return (
    <View style={box}>
      {photoUrl && !photoFailed ? (
        <Image
          source={{ uri: photoUrl, headers: photoHeaders }}
          style={[styles.thumb, box]}
          resizeMode="cover"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View style={[styles.thumb, styles.placeholder, box]}>
          <Ionicons
            name={pkg.hasArrivalPhoto ? "image-outline" : "cube-outline"}
            size={Math.round(size * 0.38)}
            color="#9CA3AF"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { backgroundColor: "#E5E7EB" },
  placeholder: { alignItems: "center", justifyContent: "center" },
});
