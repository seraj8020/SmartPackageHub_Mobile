import { parseLabel, type ParsedLabel } from "@/features/package-intake/services/labelParse";

export interface OcrResult {
  text: string;
  parsed: ParsedLabel;
  elapsedMs: number;
  available: boolean;
}

/**
 * On-device OCR via Google ML Kit Text Recognition.
 * Requires a development build (not Expo Go). Falls back gracefully when unavailable.
 */
export async function recognizeLabelFromUri(imageUri: string): Promise<OcrResult> {
  const started = Date.now();
  try {
    // Dynamic import so Expo Go / web still load the app without the native module.
    const TextRecognition = (
      await import("@react-native-ml-kit/text-recognition")
    ).default;
    const result = await TextRecognition.recognize(imageUri);
    const text = (result?.text ?? "").trim();
    return {
      text,
      parsed: parseLabel(text),
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
      return {
        text: "",
        parsed: parseLabel(""),
        elapsedMs: Date.now() - started,
        available: false,
      };
    }
    throw err;
  }
}
