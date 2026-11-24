import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import {
  confirmIntake,
  uploadDamagePhoto,
  uploadParcelPhoto,
  type ConfirmIntakeResult,
  type ResidentMatch,
} from "@/features/package-intake/services/intakeApi";
import {
  DEFAULT_INTAKE_HEIGHT_CM,
  DEFAULT_INTAKE_LENGTH_CM,
  DEFAULT_INTAKE_WEIGHT_KG,
  DEFAULT_INTAKE_WIDTH_CM,
  STAFF_NAME_STORAGE_KEY,
} from "@/features/package-intake/constants";
import { createClientId } from "@/shared/utils/createClientId";
import { useLabelScanner } from "@/features/package-intake/hooks/useLabelScanner";
import { useResidentMatching } from "@/features/package-intake/hooks/useResidentMatching";
import { enqueueIntake } from "@/features/package-intake/services/intakeQueueDb";
import { flushIntakeQueue } from "@/features/package-intake/services/intakeQueueSync";

function parsePositiveNumber(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function usePackageIntake(options: {
  societyId: string;
  staffUserId: string;
  /** Logged-in staff username / display name used to prefill the staff name field. */
  defaultStaffName?: string;
}) {
  const { societyId, staffUserId, defaultStaffName } = options;
  const alive = useRef(true);
  const manualPick = useRef(false);
  const requestId = useRef(createClientId());
  const loginName = (defaultStaffName ?? "").trim();

  const scanner = useLabelScanner();
  const matching = useResidentMatching({
    alive,
    manualPick,
    societyId,
    tower: scanner.tower,
    flat: scanner.flat,
    name: scanner.name,
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [isColdStorage, setIsColdStorage] = useState(false);
  const [isCod, setIsCod] = useState(false);
  const [codAmount, setCodAmount] = useState("");
  const [damaged, setDamaged] = useState(false);
  const [damageNote, setDamageNote] = useState("");
  const [damagePhoto, setDamagePhoto] = useState<string | null>(null);
  const [staffName, setStaffName] = useState(loginName || "Hub Staff");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ConfirmIntakeResult | null>(null);
  const [damageState, setDamageState] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<string | null>(null);
  const [parcelPhotoReady, setParcelPhotoReady] = useState(false);

  useEffect(() => {
    alive.current = true;
    void (async () => {
      const stored = (await SecureStore.getItemAsync(STAFF_NAME_STORAGE_KEY))?.trim();
      if (!alive.current) return;
      // Prefer a previously saved custom name; otherwise use the logged-in account.
      if (stored && stored !== "Hub Staff") {
        setStaffName(stored);
        return;
      }
      if (loginName) {
        setStaffName(loginName);
        await SecureStore.setItemAsync(STAFF_NAME_STORAGE_KEY, loginName);
        return;
      }
      if (stored) setStaffName(stored);
    })();
    return () => {
      alive.current = false;
    };
  }, [loginName]);

  // When directory match / search pick succeeds, always fill recipient name (+ unit fields).
  useEffect(() => {
    if (matching.match.status !== "matched" || !matching.selected) return;
    scanner.applyResidentFields(matching.selected);
    // Only re-run when the matched resident identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyResidentFields is stable enough per selected id
  }, [matching.match.status, matching.selected?.id]);

  // Open package details when OCR fills weight / dimensions.
  useEffect(() => {
    if (scanner.packageDetailsHint) setDetailsOpen(true);
  }, [scanner.packageDetailsHint]);

  function chooseResident(resident: ResidentMatch) {
    matching.selectResident(resident);
    scanner.applyResidentFields(resident);
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

  async function captureStill(options?: { withBase64?: boolean }) {
    if (!scanner.cameraOn) {
      throw new Error("Open the camera first, then snap the parcel photo.");
    }
    const ready = await scanner.waitForCameraReady(5000);
    const camera = scanner.cameraRef.current;
    if (!ready || !camera) {
      await scanner.recoverAfterStill();
      throw new Error("Camera is not ready. Open camera, wait for the preview, then snap again.");
    }
    try {
      // skipProcessing:false so quality compression applies (otherwise full-res phone JPEGs exceed API limits).
      const photo = await withTimeout(
        camera.takePictureAsync({
          quality: 0.35,
          base64: options?.withBase64 === true,
          skipProcessing: false,
          shutterSound: false,
        }),
        12000,
        "Photo capture timed out. Tap Open camera / Scan barcode again, then retry the snap.",
      );
      if (!photo?.uri) {
        throw new Error("Could not capture parcel photo.");
      }
      return photo;
    } finally {
      // Still capture freezes live preview on many Android devices — remount recovers it.
      await scanner.recoverAfterStill();
    }
  }

  /** Traizr-style arrival photo — always stored for the resident package record. */
  async function ensureArrivalPhoto(): Promise<{ clientPhotoId: string; uri: string }> {
    if (scanner.photoIdRef.current && scanner.photoUriRef.current) {
      return { clientPhotoId: scanner.photoIdRef.current, uri: scanner.photoUriRef.current };
    }
    const photo = await captureStill();
    const clientPhotoId = createClientId();
    scanner.photoIdRef.current = clientPhotoId;
    scanner.photoUriRef.current = photo.uri;
    setParcelPhotoReady(true);
    setPhotoState("Arrival photo captured");
    return { clientPhotoId, uri: photo.uri };
  }

  /** Explicit snap for a normal (undamaged) parcel — stores under arrival/. */
  async function snapParcelPhoto() {
    try {
      scanner.setError(null);
      setPhotoState("Capturing parcel photo…");
      const photo = await captureStill();
      const clientPhotoId = createClientId();
      scanner.photoIdRef.current = clientPhotoId;
      scanner.photoUriRef.current = photo.uri;
      if (alive.current) {
        setParcelPhotoReady(true);
        setPhotoState("Parcel photo captured · will upload on confirm");
      }
    } catch (err) {
      if (alive.current) setPhotoState(null);
      scanner.setError(err instanceof Error ? err.message : "Parcel snap failed");
    }
  }

  async function markDamaged() {
    try {
      scanner.setError(null);
      setDamageState("Capturing damage photo…");
      const photo = await captureStill({ withBase64: true });
      if (!photo.base64) {
        scanner.setError("Could not capture damage photo.");
        setDamageState(null);
        return;
      }
      setDamagePhoto(`data:image/jpeg;base64,${photo.base64}`);
      setDamaged(true);
      setDamageState("Damage photo captured");
      // Reuse the same frame as arrival photo when none exists yet.
      if (!scanner.photoUriRef.current) {
        const clientPhotoId = createClientId();
        scanner.photoIdRef.current = clientPhotoId;
        scanner.photoUriRef.current = photo.uri;
        setParcelPhotoReady(true);
        setPhotoState("Arrival photo captured (from damage snap)");
      }
    } catch (err) {
      setDamageState(null);
      scanner.setError(err instanceof Error ? err.message : "Damage snap failed");
    }
  }

  async function confirm() {
    setBusy(true);
    scanner.setError(null);
    const trimmedName = staffName.trim() || "Hub Staff";
    await SecureStore.setItemAsync(STAFF_NAME_STORAGE_KEY, trimmedName);

    const courier = scanner.courier.trim();
    if (!courier) {
      scanner.setError("Courier is required. Enter the courier name if OCR did not fill it.");
      setBusy(false);
      return;
    }

    if (isCod && !parsePositiveNumber(codAmount)) {
      scanner.setError("Enter a valid COD amount when pay on delivery is required.");
      setDetailsOpen(true);
      setBusy(false);
      return;
    }

    try {
      // Traizr-style: always capture an arrival photo for the resident package record.
      let arrival: { clientPhotoId: string; uri: string };
      try {
        arrival = await ensureArrivalPhoto();
        if (alive.current) setPhotoState("Arrival photo captured");
      } catch (photoErr) {
        scanner.setError(
          photoErr instanceof Error
            ? photoErr.message
            : "Arrival photo is required. Open the camera and try again.",
        );
        setBusy(false);
        return;
      }

      const payload = {
        awb: scanner.awb.trim(),
        barcode: scanner.barcodeRef.current || undefined,
        courier,
        recipientName: scanner.name.trim() || undefined,
        tower: scanner.tower.trim() || undefined,
        flatNumber: scanner.flat.trim() || undefined,
        residentId: matching.selected?.id,
        societyId: societyId || undefined,
        staffUserId,
        staffName: trimmedName,
        rawOcrText: scanner.rawTextRef.current || undefined,
        ocrElapsedMs: scanner.elapsedMs ?? undefined,
        clientRequestId: requestId.current,
        clientPhotoId: arrival.clientPhotoId,
        localArrivalPhotoUri: arrival.uri,
        isDamaged: damaged,
        damageNote: damageNote.trim() || undefined,
        matchStatus: matching.selected ? matching.matchMode : "missing",
        category: category.trim() || undefined,
        isColdStorage,
        weight: parsePositiveNumber(scanner.weight) ?? DEFAULT_INTAKE_WEIGHT_KG,
        length: parsePositiveNumber(scanner.length) ?? DEFAULT_INTAKE_LENGTH_CM,
        width: parsePositiveNumber(scanner.width) ?? DEFAULT_INTAKE_WIDTH_CM,
        height: parsePositiveNumber(scanner.height) ?? DEFAULT_INTAKE_HEIGHT_CM,
        isCod,
        codAmount: isCod ? parsePositiveNumber(codAmount) : undefined,
      };

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        // Defer upload until queue flush; ConfirmIntake links via clientPhotoId once photo is stored.
        const queued = await enqueueIntake(payload);
        scanner.stopCamera();
        setReceipt(queued);
        if (alive.current) setPhotoState("Arrival photo queued offline");
        void flushIntakeQueue();
        return;
      }

      try {
        setPhotoState("Uploading arrival photo…");
        await uploadParcelPhoto(arrival.clientPhotoId, arrival.uri);
        if (alive.current) setPhotoState("Arrival photo saved");
        const result = await confirmIntake(payload);
        // Confirm writes the intake↔photo link; re-upload links PackageImage if the first link missed.
        if (!result.photoStored && arrival.clientPhotoId && arrival.uri) {
          try {
            await uploadParcelPhoto(arrival.clientPhotoId, arrival.uri);
            if (alive.current) setPhotoState("Arrival photo linked for resident");
          } catch {
            if (alive.current) {
              setPhotoState("Arrival photo saved but not linked — resident may not see it yet");
            }
          }
        }
        scanner.stopCamera();
        setReceipt(result);
        if (damagePhoto) {
          setDamageState("Saving damage photo…");
          uploadDamagePhoto(result.intakeId, damagePhoto, damageNote.trim() || undefined)
            .then(() => {
              if (alive.current) setDamageState("Damage photo saved");
            })
            .catch((err) => {
              if (alive.current) {
                setDamageState(
                  err instanceof Error ? err.message : "Damage photo was not saved",
                );
              }
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const networkFlake =
          /network request failed|failed to fetch|timed?\s*out|ECONNREFUSED|ENOTFOUND|unreachable|offline/i.test(
            message,
          );
        if (!networkFlake) {
          // Hub rejected the intake (validation, duplicate AWB, auth, etc.) — do not fake offline.
          scanner.setError(message || "Could not confirm intake");
          return;
        }
        // Network flake mid-request → queue with same clientRequestId (idempotent).
        const queued = await enqueueIntake(payload);
        scanner.stopCamera();
        setReceipt(queued);
        scanner.setError(`Saved offline · ${message}`);
        void flushIntakeQueue();
      }
    } catch (err) {
      scanner.setError(err instanceof Error ? err.message : "Could not confirm intake");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    requestId.current = createClientId();
    // Keep camera on for the next package in a bulk intake session.
    scanner.resetScanner({ keepCamera: true });
    matching.resetMatching();
    setDetailsOpen(false);
    setCategory("");
    setIsColdStorage(false);
    setIsCod(false);
    setCodAmount("");
    setDamaged(false);
    setDamageNote("");
    setDamagePhoto(null);
    setBusy(false);
    setReceipt(null);
    setDamageState(null);
    setPhotoState(null);
    setParcelPhotoReady(false);
  }

  const canConfirm =
    scanner.awb.trim().length >= 6 &&
    scanner.courier.trim().length >= 2 &&
    !matching.ambiguous &&
    (Boolean(matching.selected) || scanner.flat.trim().length >= 2) &&
    !busy;

  return {
    ...scanner,
    match: matching.match,
    selected: matching.selected,
    query: matching.query,
    searchHits: matching.searchHits,
    searching: matching.searching,
    setQuery: matching.setQuery,
    chooseResident,
    detailsOpen,
    setDetailsOpen,
    category,
    setCategory,
    isColdStorage,
    setIsColdStorage,
    weight: scanner.weight,
    setWeight: scanner.setWeightEdited,
    length: scanner.length,
    setLength: scanner.setLengthEdited,
    width: scanner.width,
    setWidth: scanner.setWidthEdited,
    height: scanner.height,
    setHeight: scanner.setHeightEdited,
    isCod,
    setIsCod,
    codAmount,
    setCodAmount,
    damaged,
    damageNote,
    setDamageNote,
    staffName,
    setStaffName,
    busy,
    receipt,
    damageState,
    // Prefer upload/status from intake over scanner OCR caption.
    photoState: photoState ?? scanner.photoState,
    canConfirm,
    parcelPhotoReady: parcelPhotoReady || Boolean(scanner.photoUriRef.current),
    snapParcelPhoto,
    markDamaged,
    confirm,
    reset,
  };
}
