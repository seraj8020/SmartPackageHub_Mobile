import { useCallback, useRef, useState } from "react";
import type { CameraView, BarcodeScanningResult } from "expo-camera";
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

export function useLabelScanner() {
  const cameraRef = useRef<CameraView | null>(null);
  const barcodeRef = useRef("");
  const rawTextRef = useRef("");
  const photoIdRef = useRef<string | null>(null);
  const edited = useRef<EditedFlags>(emptyEdited());
  const ocrBusy = useRef(false);
  const lastScanAt = useRef(0);

  const [cameraOn, setCameraOn] = useState(true);
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

  async function runOcrFromCamera(reason: string) {
    if (ocrBusy.current) return;
    const camera = cameraRef.current;
    if (!camera) {
      setError("Camera is not ready yet.");
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
        return;
      }
      photoIdRef.current = createClientId();
      setPhotoState("Label frame captured");
      const ocr = await recognizeLabelFromUri(photo.uri);
      setElapsedMs(ocr.elapsedMs);
      if (!ocr.available) {
        setStatus("OCR unavailable in Expo Go");
        setConfidence(null);
        setError(
          "ML Kit is not linked in this build. Stop Expo Go, then run: npx expo run:android (or eas build). After install, open the Smart Package Hub app — not Expo Go.",
        );
        return;
      }
      rawTextRef.current = ocr.text;
      const { parsed } = ocr;
      if (!edited.current.courier && parsed.courier) setCourier(parsed.courier);
      if (!edited.current.awb && parsed.awb) setAwb(parsed.awb);
      if (!edited.current.name && parsed.recipientName) setName(parsed.recipientName);
      if (!edited.current.tower && parsed.tower) setTower(parsed.tower);
      if (!edited.current.flat && parsed.flatNumber) setFlat(parsed.flatNumber);
      const filled =
        [parsed.courier, parsed.awb, parsed.recipientName, parsed.tower, parsed.flatNumber].filter(
          Boolean,
        ).length;
      const score = ocr.text.length < 20 ? 30 : Math.min(95, 40 + filled * 12);
      setConfidence(score);
      setStatus(
        score < 45
          ? "Low OCR confidence — verify fields before confirm"
          : "Label read · verify fields",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setReading(false);
      ocrBusy.current = false;
    }
  }

  function onBarcodeScanned(result: BarcodeScanningResult) {
    const now = Date.now();
    if (now - lastScanAt.current < 1200) return;
    const data = (result.data ?? "").trim();
    if (data.length < 6) return;
    lastScanAt.current = now;
    barcodeRef.current = data;
    if (!edited.current.awb) {
      setAwb(data.toUpperCase());
    }
    setScanningEnabled(false);
    setStatus("Barcode locked · reading label…");
    void runOcrFromCamera("Reading label with on-device OCR…");
  }

  function rereadLabel() {
    setScanningEnabled(false);
    void runOcrFromCamera("Re-reading label…");
  }

  function resumeScanning() {
    setScanningEnabled(true);
    setStatus("Point at the tracking barcode");
  }

  function stopCamera() {
    setCameraOn(false);
    setScanningEnabled(false);
  }

  function startCamera() {
    setCameraOn(true);
    setScanningEnabled(true);
    setStatus("Point at the tracking barcode");
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
  }

  return {
    cameraRef,
    barcodeRef,
    rawTextRef,
    photoIdRef,
    cameraOn,
    scanningEnabled,
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
    rereadLabel,
    resumeScanning,
    stopCamera,
    startCamera,
    resetScanner,
  };
}
