import { StyleSheet, View } from "react-native";
import {
  BottomTabBar,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { useTabBarBottomInset } from "@/app/navigation/useTabBarBottomInset";
import { colors } from "@/shared/theme/colors";

const TAB_CONTENT_HEIGHT = 58;

/**
 * Wraps the default tab bar and pads below it with a measured Android inset.
 * Needed on Samsung Galaxy where safe-area bottom inset is often wrong/zero.
 */
export function SafeBottomTabBar(props: BottomTabBarProps) {
  const bottomInset = useTabBarBottomInset();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: bottomInset,
        },
      ]}
    >
      <BottomTabBar
        {...props}
        insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
        style={[
          styles.bar,
          { height: TAB_CONTENT_HEIGHT },
          props.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  bar: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
});

export const tabBarScreenOptions = {
  headerShown: false as const,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: "#9CA3AF",
  tabBarHideOnKeyboard: true,
  tabBarItemStyle: {
    paddingVertical: 4,
    minHeight: 48,
  },
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.2,
  },
};
