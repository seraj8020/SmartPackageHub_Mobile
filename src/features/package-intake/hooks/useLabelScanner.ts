import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraView, BarcodeScanningResult } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import type { ResidentMatch } from "@/features/package-intake/services/intakeApi";
import { recognizeLabelFromUri } from "@/features/package-intake/services/labelOcr";
import { createClientId } from "@/shared/utils/createClientId";

type EditedFlags = {
  courier: boolean;
  awb: boolean;
  name: boolean;
  tower: boolean;
  flat: boolean;
};

const emptyEdited = (): EditedFlags => ({
  courier: false,
  awb: false,
  name: false,
  tower: false,
  flat: false,
});

function isExpoGo(): boolean {
  try {
    // Nested under expo — resolve at runtime so Expo Go detection still works.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require("expo-constants").default as {
      appOwnership?: string | null;
    };
    return Constants.appOwnership === "expo";
  } catch {
    return false;
  }
}

export function useLabelScanner() {
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView | null>(null);
  const barcodeRef = useRef("");
  const rawTextRef = useRef("");
  const photoIdRef = useRef<string | null>(null);
  const edited = useRef<EditedFlags>(emptyEdited());
  const ocrBusy = useRef(false);
  const lastScanAt = useRef(0);
  const ocrSupported = useRef<boolean | null>(isExpoGo() ? false : null);

  const [cameraOn, setCameraOn] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraEpoch, setCameraEpoch] = useState(0);
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState("Point at the tracking barcode");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [courier, setCourier] = useState("Other");
  const [awb, setAwb] = useState("");
  const [name, setName] = useState("");
  const [tower, setTower] = useState("");
  const [flat, setFlat] = useState("");

  // Remount camera when returning to Scan tab so Android barcode analyzer rebinds.
  useEffect(() => {
    if (!isFocused || !cameraOn) return;
    setCameraReady(false);
    setCameraEpoch((value) => value + 1);
  }, [isFocused, cameraOn]);

  const setCourierEdited = useCallback((value: string) => {
    edited.current.courier = true;
    setCourier(value);
  }, []);
  const setAwbEdited = useCallback((value: string) => {
    edited.current.awb = true;
    setAwb(value.toUpperCase());
  }, []);
  const setNameEdited = useCallback((value: string) => {
    edited.current.name = true;
    setName(value);
  }, []);
  const setTowerEdited = useCallback((value: string) => {
    edited.current.tower = true;
    setTower(value.toUpperCase());
  }, []);
  const setFlatEdited = useCallback((value: string) => {
    edited.current.flat = true;
    setFlat(value);
  }, []);

  function applyResidentFields(resident: ResidentMatch) {
    if (resident.name) {
      edited.current.name = true;
      setName(resident.name);
    }
    if (resident.tower) {
      edited.current.tower = true;
      setTower(String(resident.tower).toUpperCase());
    }
    if (resident.flatNumber) {
      edited.current.flat = true;
      setFlat(String(resident.flatNumber));
    }
  }

  function bumpCamera() {
    setCameraReady(false);
    setCameraEpoch((value) => value + 1);
  }

  async function runOcrFromCamera(reason: string) {
    if (ocrBusy.current) return;

    // Expo Go has no ML Kit — skip capture so barcode scanning keeps working.
    if (ocrSupported.current === false || isExpoGo()) {
      ocrSupported.current = false;
      setReading(false);
      setConfidence(null);
      setStatus("Barcode locked · fill fields manually (OCR needs development build)");
      setError(
        "OCR is unavailable in Expo Go. Barcode AWB is filled — enter courier/name/tower/flat, or use a development build for OCR.",
      );
      return;
    }

    const camera = cameraRef.current;
    if (!camera || !cameraReady) {
      setError("Camera is not ready yet. Tap Scan barcode again, then retry OCR.");
      setScanningEnabled(true);
      bumpCamera();
      return;
    }

    ocrBusy.current = true;
    setReading(true);
    setStatus(reason);
    setError(null);
    try {
      const photo = await camera.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!photo?.uri) {
        setError("Could not capture label frame.");
        setScanningEnabled(true);
        bumpCamera();
        return;
      }
      photoIdRef.current = createClientId();
      setPhotoState("Label frame captured");
      const ocr = await recognizeLabelFromUri(photo.uri);
      setElapsedMs(ocr.elapsedMs);
      if (!ocr.available) {
        ocrSupported.current = false;
        setStatus("Barcode locked · fill fields manually (OCR needs development build)");
        setConfidence(null);
        setError(
          "ML Kit is not linked in this build. Use npx expo run:android for OCR. Barcode AWB is still filled.",
        );
        bumpCamera();
        return;
      }
      ocrSupported.current = true;
      rawTextRef.current = ocr.text;
      const { parsed } = ocr;
      if (!edited.current.courier && parsed.courier) setCourier(parsed.courier);
      if (!edited.current.awb && parsed.awb) setAwb(parsed.awb);
      if (!edited.current.name && parsed.recipientName) setName(parsed.recipientName);
      if (!edited.current.tower && parsed.tower) setTower(parsed.tower);
      if (!edited.current.flat && parsed.flatNumber) setFlat(parsed.flatNumber);
      const filled = [
        parsed.courier,
        parsed.awb,
        parsed.recipientName,
        parsed.tower,
        parsed.flatNumber,
      ].filter(Boolean).length;
      const score = ocr.text.length < 20 ? 30 : Math.min(95, 40 + filled * 12);
      setConfidence(score);
      setStatus(
        score < 45
          ? "Low OCR confidence — verify fields before confirm"
          : "Label read · verify fields",
      );
      bumpCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed");
      setScanningEnabled(true);
      bumpCamera();
    } finally {
      setReading(false);
      ocrBusy.current = false;
    }
  }

  function onBarcodeScanned(result: BarcodeScanningResult) {
    if (!isFocused || !scanningEnabled || reading) return;
    const now = Date.now();
    if (now - lastScanAt.current < 1200) return;
    const data = (result.data ?? "").trim();
    if (data.length < 4) return;
    lastScanAt.current = now;
    barcodeRef.current = data;
    if (!edited.current.awb) {
      setAwb(data.toUpperCase());
    }
    setScanningEnabled(false);
    setError(null);

    if (ocrSupported.current === false || isExpoGo()) {
      setStatus("Barcode locked · fill remaining fields");
      setError(
        "OCR is unavailable in Expo Go. AWB is filled from the barcode — enter other fields or tap Scan barcode again.",
      );
      return;
    }

    setStatus("Barcode locked · reading label…");
    void runOcrFromCamera("Reading label with on-device OCR…");
  }

  function rereadLabel() {
    if (ocrSupported.current === false || isExpoGo()) {
      setError(
        "OCR needs a development build (npx expo run:android). Barcode scanning still works in Expo Go.",
      );
      return;
    }
    setScanningEnabled(false);
    void runOcrFromCamera("Re-reading label…");
  }

  function resumeScanning() {
    setError(null);
    setScanningEnabled(true);
    setStatus("Point at the tracking barcode");
    bumpCamera();
  }

  function stopCamera() {
    setCameraOn(false);
    setCameraReady(false);
    setScanningEnabled(false);
  }

  function startCamera() {
    setCameraOn(true);
    setScanningEnabled(true);
    setStatus("Point at the tracking barcode");
    bumpCamera();
  }

  function resetScanner() {
    barcodeRef.current = "";
    rawTextRef.current = "";
    photoIdRef.current = null;
    edited.current = emptyEdited();
    ocrBusy.current = false;
    lastScanAt.current = 0;
    setCourier("Other");
    setAwb("");
    setName("");
    setTower("");
    setFlat("");
    setReading(false);
    setConfidence(null);
    setElapsedMs(null);
    setError(null);
    setPhotoState(null);
    setCameraOn(true);
    setScanningEnabled(true);
    setStatus("Point at the tracking barcode");
    bumpCamera();
  }

  const canScan = isFocused && cameraOn && scanningEnabled && !reading;

  return {
    cameraRef,
    barcodeRef,
    rawTextRef,
    photoIdRef,
    cameraOn,
    cameraReady,
    cameraEpoch,
    scanningEnabled: canScan,
    reading,
    status,
    confidence,
    error,
    photoState,
    elapsedMs,
    courier,
    awb,
    name,
    tower,
    flat,
    setError,
    setCourierEdited,
    setAwbEdited,
    setNameEdited,
    setTowerEdited,
    setFlatEdited,
    applyResidentFields,
    onBarcodeScanned,
    onCameraReady: () => setCameraReady(true),
    rereadLabel,
    resumeScanning,
    stopCamera,
    startCamera,
    resetScanner,
  };
}
