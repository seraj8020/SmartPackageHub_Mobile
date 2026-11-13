import { NativeModules } from "react-native";
import { parseLabel, type ParsedLabel } from "@/features/package-intake/services/labelParse";

export interface OcrResult {
  text: string;
  parsed: ParsedLabel;
  elapsedMs: number;
  available: boolean;
}

function emptyUnavailable(started: number): OcrResult {
  return {
    text: "",
    parsed: parseLabel(""),
    elapsedMs: Date.now() - started,
    available: false,
  };
}

/**
 * On-device OCR via Google ML Kit Text Recognition.
 * Requires a development build (not Expo Go). Falls back gracefully when unavailable.
 */
export async function recognizeLabelFromUri(imageUri: string): Promise<OcrResult> {
  const started = Date.now();
  // Autolinked as NativeModules.TextRecognition — null means Expo Go / stale APK.
  if (!NativeModules.TextRecognition) {
    if (__DEV__) {
      console.warn("[labelOcr] NativeModules.TextRecognition is null — rebuild with npx expo run:android");
    }
    return emptyUnavailable(started);
  }
  try {
    // Dynamic import so Expo Go / web still load the app without the native module.
    const TextRecognition = (
      await import("@react-native-ml-kit/text-recognition")
    ).default;
    const result = await TextRecognition.recognize(imageUri);
    const text = (result?.text ?? "").trim();
    const parsed = parseLabel(text);
    // Always print in Metro/PowerShell so staff OCR debugging stays visible.
    console.log(
      `[labelOcr] ${text.length} chars → name=${parsed.recipientName} tower=${parsed.tower} flat=${parsed.flatNumber} awb=${parsed.awb} courier=${parsed.courier}`,
    );
    console.log(`[labelOcr] raw:\n${text}`);
    return {
      text,
      parsed,
      elapsedMs: Date.now() - started,
      available: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missingNative =
      /cannot find|native module|not linked|doesn'?t seem to be linked|Invariant Violation|TurboModule|expo managed/i.test(
        message,
      );
    if (missingNative) {
      return emptyUnavailable(started);
    }
    throw err;
  }
}
