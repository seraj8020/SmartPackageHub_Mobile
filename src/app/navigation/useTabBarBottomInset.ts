import { Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Samsung One UI / Android 15 often report insets.bottom as 0 while the
 * system navigation bar still covers the tab bar and steals taps.
 */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== "android") {
    return Math.max(insets.bottom, 0);
  }

  const screenH = Dimensions.get("screen").height;
  const windowH = Dimensions.get("window").height;
  const screenWindowGap = Math.max(0, Math.round(screenH - windowH));

  // 48 ≈ classic 3-button nav; gesture-handle-only devices still need a floor.
  return Math.max(insets.bottom, screenWindowGap, 48);
}
