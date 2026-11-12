import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { colors } from "@/shared/theme/colors";

type Props = {
  children: ReactNode;
};

/**
 * Top-aligned auth form that stays above the soft keyboard.
 * Uses keyboard height padding because KeyboardAvoidingView is unreliable on Android.
 */
export function AuthFormScreen({ children }: Props) {
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates.height;
      setKeyboardPad(height);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardPad(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(56, keyboardPad + 32) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
});
