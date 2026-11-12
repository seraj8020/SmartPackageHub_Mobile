import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
  onPress: () => void;
};

/** Compact sign-out control that keeps a stable tap target in tight headers. */
export function SignOutButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <Text style={styles.label}>Sign out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
  },
  pressed: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  label: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "700",
  },
});
