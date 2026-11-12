import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { BARCODE_TYPES } from "@/features/package-intake/constants";
import { colors } from "@/shared/theme/colors";
import type { RefObject } from "react";

type Props = {
  cameraRef: RefObject<CameraView | null>;
  cameraOn: boolean;
  scanningEnabled: boolean;
  reading: boolean;
  status: string;
  confidence: number | null;
  photoState: string | null;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onRequestPermission?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function IntakeCameraPanel({
  cameraRef,
  cameraOn,
  scanningEnabled,
  reading,
  status,
  confidence,
  photoState,
  onBarcodeScanned,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.shell}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.shell}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Staff intake scans tracking barcodes on-device. Allow camera to continue.
        </Text>
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.shell}>
        {cameraOn ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            barcodeScannerSettings={{
              barcodeTypes: [...BARCODE_TYPES],
            }}
            onBarcodeScanned={scanningEnabled ? onBarcodeScanned : undefined}
          />
        ) : (
          <View style={styles.stopped}>
            <Text style={styles.stoppedText}>Camera stopped</Text>
          </View>
        )}
        <View style={styles.reticle} pointerEvents="none" />
        {reading && (
          <View style={styles.readingOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.readingText}>Reading label…</Text>
          </View>
        )}
      </View>
      <Text style={styles.status}>{status}</Text>
      {confidence != null && confidence < 45 && (
        <Text style={styles.warn}>Low OCR confidence — double-check AWB and flat</Text>
      )}
      {photoState ? <Text style={styles.meta}>{photoState}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  shell: {
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  reticle: {
    position: "absolute",
    width: "72%",
    height: 88,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
  },
  readingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  readingText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  warn: { marginTop: 4, fontSize: 11, color: "#B45309", fontWeight: "600" },
  meta: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  stopped: { alignItems: "center", justifyContent: "center" },
  stoppedText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  permTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  permBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  permBtn: {
    marginTop: 14,
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
