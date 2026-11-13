import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import {
  confirmIntake,
  uploadDamagePhoto,
  type ConfirmIntakeResult,
  type ResidentMatch,
} from "@/features/package-intake/services/intakeApi";
import { STAFF_NAME_STORAGE_KEY } from "@/features/package-intake/constants";
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
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [isCod, setIsCod] = useState(false);
  const [codAmount, setCodAmount] = useState("");
  const [damaged, setDamaged] = useState(false);
  const [damageNote, setDamageNote] = useState("");
  const [damagePhoto, setDamagePhoto] = useState<string | null>(null);
  const [staffName, setStaffName] = useState(loginName || "Hub Staff");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ConfirmIntakeResult | null>(null);
  const [damageState, setDamageState] = useState<string | null>(null);

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

  // OCR often misses tower/flat on rotated Meesho labels — backfill from a firm name match.
  useEffect(() => {
    if (matching.match.status !== "matched" || !matching.selected) return;
    scanner.hydrateEmptyFieldsFromResident(matching.selected);
  }, [matching.match.status, matching.selected, scanner.hydrateEmptyFieldsFromResident]);

  function chooseResident(resident: ResidentMatch) {
    matching.selectResident(resident);
    scanner.applyResidentFields(resident);
  }

  async function markDamaged() {
    const camera = scanner.cameraRef.current;
    if (!camera || !scanner.cameraOn) {
      scanner.setError("Open the camera, then tap damage to snap the box.");
      return;
    }
    try {
      // skipProcessing:false so quality compression applies (otherwise full-res phone JPEGs exceed API limits).
      const photo = await camera.takePictureAsync({
        quality: 0.35,
        base64: true,
        skipProcessing: false,
        shutterSound: false,
      });
      if (!photo?.base64) {
        scanner.setError("Could not capture damage photo.");
        return;
      }
      setDamagePhoto(`data:image/jpeg;base64,${photo.base64}`);
      setDamaged(true);
    } catch (err) {
      scanner.setError(err instanceof Error ? err.message : "Damage snap failed");
    }
  }

  async function confirm() {
    setBusy(true);
    scanner.setError(null);
    const trimmedName = staffName.trim() || "Hub Staff";
    await SecureStore.setItemAsync(STAFF_NAME_STORAGE_KEY, trimmedName);

    if (isCod && !parsePositiveNumber(codAmount)) {
      scanner.setError("Enter a valid COD amount when pay on delivery is required.");
      setDetailsOpen(true);
      setBusy(false);
      return;
    }

    const payload = {
      awb: scanner.awb.trim(),
      barcode: scanner.barcodeRef.current || undefined,
      courier: scanner.courier,
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
      clientPhotoId: scanner.photoIdRef.current ?? undefined,
      isDamaged: damaged,
      damageNote: damageNote.trim() || undefined,
      matchStatus: matching.selected ? matching.matchMode : "missing",
      category: category.trim() || undefined,
      isColdStorage,
      weight: parsePositiveNumber(weight),
      length: parsePositiveNumber(length),
      width: parsePositiveNumber(width),
      height: parsePositiveNumber(height),
      isCod,
      codAmount: isCod ? parsePositiveNumber(codAmount) : undefined,
    };

    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        const queued = await enqueueIntake(payload);
        scanner.stopCamera();
        setReceipt(queued);
        void flushIntakeQueue();
        return;
      }

      try {
        const result = await confirmIntake(payload);
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
    setWeight("");
    setLength("");
    setWidth("");
    setHeight("");
    setIsCod(false);
    setCodAmount("");
    setDamaged(false);
    setDamageNote("");
    setDamagePhoto(null);
    setBusy(false);
    setReceipt(null);
    setDamageState(null);
  }

  const canConfirm =
    scanner.awb.trim().length >= 6 &&
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
    weight,
    setWeight,
    length,
    setLength,
    width,
    setWidth,
    height,
    setHeight,
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
    canConfirm,
    markDamaged,
    confirm,
    reset,
  };
}
