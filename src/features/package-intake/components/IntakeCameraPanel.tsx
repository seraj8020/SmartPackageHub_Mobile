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
import { Ionicons } from "@expo/vector-icons";
import { BARCODE_TYPES } from "@/features/package-intake/constants";
import { colors } from "@/shared/theme/colors";
import type { RefObject } from "react";

type Props = {
  cameraRef: RefObject<CameraView | null>;
  cameraOn: boolean;
  cameraEpoch?: number;
  scanningEnabled: boolean;
  reading: boolean;
  status: string;
  confidence: number | null;
  photoState: string | null;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCameraReady?: () => void;
  onStartCamera: () => void;
  style?: StyleProp<ViewStyle>;
};

export function IntakeCameraPanel({
  cameraRef,
  cameraOn,
  cameraEpoch = 0,
  scanningEnabled,
  reading,
  status,
  confidence,
  photoState,
  onBarcodeScanned,
  onCameraReady,
  onStartCamera,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  async function handleStartCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    onStartCamera();
  }

  if (!permission) {
    return (
      <View style={styles.shell}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted && cameraOn) {
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
          <>
            <CameraView
              key={`intake-camera-${cameraEpoch}`}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              barcodeScannerSettings={{
                barcodeTypes: [...BARCODE_TYPES],
              }}
              onCameraReady={onCameraReady}
              onBarcodeScanned={scanningEnabled ? onBarcodeScanned : undefined}
            />
            <View style={styles.reticle} pointerEvents="none" />
            {reading ? (
              <View style={styles.readingOverlay}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.readingText}>Reading label…</Text>
                <Text style={styles.readingHint}>You can still edit fields below</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.stopped}>
            <Pressable style={styles.openBtn} onPress={() => void handleStartCamera()}>
              <Ionicons name="camera-outline" size={16} color="#fff" />
              <Text style={styles.openBtnText}>Open camera</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text style={styles.status}>{status}</Text>
      {confidence != null && confidence < 45 ? (
        <Text style={styles.warn}>Low OCR confidence — double-check AWB and flat</Text>
      ) : null}
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
    backgroundColor: "#0a1f35",
    alignItems: "center",
    justifyContent: "center",
  },
  reticle: {
    position: "absolute",
    width: "72%",
    height: 88,
    borderWidth: 2,
    borderColor: "rgba(14, 165, 233, 0.6)",
    borderRadius: 12,
  },
  readingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  readingText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  readingHint: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  warn: { marginTop: 4, fontSize: 11, color: "#B45309", fontWeight: "600" },
  meta: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  stopped: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  openBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
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
