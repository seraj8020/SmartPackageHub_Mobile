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

function normalizeResidentTower(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/^(tower|twr|block|blk)\s*/i, "")
    .trim()
    .toUpperCase();
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useLabelScanner() {
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView | null>(null);
  const barcodeRef = useRef("");
  const rawTextRef = useRef("");
  const photoIdRef = useRef<string | null>(null);
  const edited = useRef<EditedFlags>(emptyEdited());
  const ocrBusy = useRef(false);
  const ocrSession = useRef(0);
  const lastScanAt = useRef(0);
  const ocrSupported = useRef<boolean | null>(isExpoGo() ? false : null);

  // Match web: camera stays off until staff taps Open camera.
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraEpoch, setCameraEpoch] = useState(0);
  const [scanningEnabled, setScanningEnabled] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState("Open the camera to scan a shipping label");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [courier, setCourier] = useState("");
  const [awb, setAwb] = useState("");
  const [name, setName] = useState("");
  const [tower, setTower] = useState("");
  const [flat, setFlat] = useState("");

  const wasFocused = useRef(isFocused);

  // Leaving Scan (Shelf/Map/Hand/…) turns the camera off so Open camera shows on return.
  useEffect(() => {
    if (isFocused) return;
    ocrSession.current += 1;
    ocrBusy.current = false;
    setReading(false);
    setCameraOn(false);
    setCameraReady(false);
    setScanningEnabled(false);
    setStatus("Open the camera to scan a shipping label");
  }, [isFocused]);

  // Remount only when returning to Scan with camera already on (Android barcode rebind).
  // Do NOT remount on cameraOn toggle — startCamera already bumps once; double remount
  // blacks out the preview on some Samsung devices.
  useEffect(() => {
    const gainedFocus = isFocused && !wasFocused.current;
    wasFocused.current = isFocused;
    if (!gainedFocus || !cameraOn) return;
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
      setTower(normalizeResidentTower(resident.tower));
    }
    if (resident.flatNumber) {
      edited.current.flat = true;
      setFlat(String(resident.flatNumber));
    }
  }

  /** When OCR missed tower/flat but directory matched by name, fill blanks only. */
  const hydrateEmptyFieldsFromResident = useCallback((resident: ResidentMatch) => {
    if (resident.name) {
      setName((prev) => (edited.current.name || prev.trim() ? prev : resident.name!));
    }
    if (resident.tower) {
      setTower((prev) =>
        edited.current.tower || prev.trim() ? prev : normalizeResidentTower(resident.tower),
      );
    }
    if (resident.flatNumber) {
      setFlat((prev) =>
        edited.current.flat || prev.trim() ? prev : String(resident.flatNumber),
      );
    }
  }, []);

  function bumpCamera() {
    setCameraReady(false);
    setCameraEpoch((value) => value + 1);
  }

  function cancelOcr(message?: string) {
    ocrSession.current += 1;
    ocrBusy.current = false;
    setReading(false);
    if (message) setError(message);
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

    const session = ocrSession.current;
    ocrBusy.current = true;
    setReading(true);
    setStatus(reason);
    setError(null);
    try {
      const photo = await withTimeout(
        camera.takePictureAsync({
          quality: 0.85,
          skipProcessing: true,
          shutterSound: false,
        }),
        12000,
        "Label capture timed out. Tap Scan barcode again, then Re-read label.",
      );
      if (session !== ocrSession.current) return;
      if (!photo?.uri) {
        setError("Could not capture label frame.");
        setScanningEnabled(true);
        bumpCamera();
        return;
      }
      photoIdRef.current = createClientId();
      setPhotoState("Label frame captured");
      setStatus("Running on-device OCR (first run may download the model)…");
      // Emulator + Play Services often need >60s on first ML Kit Text Recognition use.
      const ocr = await withTimeout(
        recognizeLabelFromUri(photo.uri),
        180000,
        "OCR timed out. Keep the label in frame and tap Re-read label.",
      );
      if (session !== ocrSession.current) return;
      setElapsedMs(ocr.elapsedMs);
      if (!ocr.available) {
        // Do not permanently disable — a fresh native install may fix linking.
        setStatus("Barcode locked · fill fields or rebuild app for OCR");
        setConfidence(null);
        setError(
          "OCR native module missing in this install. Rebuild the app on your phone with: npx expo run:android — then open camera and tap Re-read label. Barcode AWB is still filled.",
        );
        bumpCamera();
        return;
      }
      ocrSupported.current = true;
      rawTextRef.current = ocr.text;
      const { parsed } = ocr;
      if (!edited.current.courier && parsed.courier) setCourier(parsed.courier);
      if (!edited.current.awb && parsed.awb) {
        // Prefer OCR numeric / courier AWB over QR payload junk (e.g. ST1…_001_V).
        setAwb((prev) => {
          if (!prev.trim()) return parsed.awb!;
          if (/_/.test(prev) || /_V$/i.test(prev)) return parsed.awb!;
          if (/^\d{7,15}$/.test(parsed.awb!) && !/^\d{7,15}$/.test(prev.trim())) {
            return parsed.awb!;
          }
          return prev;
        });
      }
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
      if (!ocr.text) {
        setError("OCR returned no text. Hold the label steady in the blue frame and tap Re-read label.");
        setStatus("No text found in frame");
      } else if (filled === 0) {
        setError(
          `OCR read ${ocr.text.length} chars but could not parse name/tower/flat. Check the label is upright in frame.`,
        );
        setStatus("Label text read · parse incomplete");
      } else {
        setStatus(
          score < 45
            ? "Low OCR confidence — verify fields before confirm"
            : "Label read · verify fields",
        );
      }
      setPhotoState(`OCR ${ocr.elapsedMs}ms · ${ocr.text.length} chars`);
      // Remount preview after still capture so live camera returns for next package.
      bumpCamera();
    } catch (err) {
      if (session !== ocrSession.current) return;
      setError(err instanceof Error ? err.message : "OCR failed");
      setStatus("OCR failed · tap Scan barcode again or Re-read label");
      bumpCamera();
    } finally {
      if (session === ocrSession.current) {
        setReading(false);
        ocrBusy.current = false;
      }
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
    // Lock barcode only — do not auto-capture / OCR. takePictureAsync was
    // freezing the live preview on device; staff taps Re-read label for OCR.
    setScanningEnabled(false);
    setError(null);
    setStatus("Barcode locked · tap Re-read label (OCR) or fill fields");
  }

  function rereadLabel() {
    if (ocrSupported.current === false || isExpoGo()) {
      setError(
        "OCR needs a development build (npx expo run:android). Barcode scanning still works in Expo Go.",
      );
      return;
    }
    if (!cameraOn) {
      setError("Open the camera first, then tap Re-read label (OCR).");
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
    // Drop any in-flight OCR so "Reading…" cannot block the next package.
    cancelOcr();
    setCameraOn(false);
    setCameraReady(false);
    setScanningEnabled(false);
  }

  function startCamera() {
    cancelOcr();
    setCameraOn(true);
    setScanningEnabled(true);
    setStatus("Point at the tracking barcode");
    bumpCamera();
  }

  /**
   * Clears label fields.
   * keepCamera: true after "Scan another package" so bulk intake stays in flow.
   * keepCamera: false for Clear / first open / leaving the tab.
   */
  function resetScanner(options?: { keepCamera?: boolean }) {
    cancelOcr();
    barcodeRef.current = "";
    rawTextRef.current = "";
    photoIdRef.current = null;
    edited.current = emptyEdited();
    lastScanAt.current = 0;
    setCourier("");
    setAwb("");
    setName("");
    setTower("");
    setFlat("");
    setConfidence(null);
    setElapsedMs(null);
    setError(null);
    setPhotoState(null);

    if (options?.keepCamera) {
      setCameraOn(true);
      setScanningEnabled(true);
      setStatus("Point at the tracking barcode");
      bumpCamera();
      return;
    }

    setCameraOn(false);
    setCameraReady(false);
    setScanningEnabled(false);
    setStatus("Open the camera to scan a shipping label");
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
    hydrateEmptyFieldsFromResident,
    onBarcodeScanned,
    onCameraReady: () => setCameraReady(true),
    rereadLabel,
    resumeScanning,
    stopCamera,
    startCamera,
    resetScanner,
  };
}
