import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hubColors } from "@/shared/ui/hub/hubTheme";

export function HubHomeLayout({
  brand,
  subtitle,
  onSettings,
  children,
}: {
  brand: string;
  subtitle?: string;
  onSettings?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Ionicons name="navigate-circle" size={22} color={hubColors.accent} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brand}>{brand}</Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {onSettings ? (
          <Pressable
            onPress={onSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
          >
            <Ionicons name="settings-outline" size={20} color={hubColors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function HubTile({
  title,
  subtitle,
  count,
  icon,
  wide,
  hero,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  count?: number | string | null;
  icon: keyof typeof Ionicons.glyphMap;
  wide?: boolean;
  hero?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.tile,
        wide && styles.tileWide,
        hero && styles.tileHero,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.iconWrap, hero && styles.iconWrapHero, wide && !hero && styles.iconWrapWide]}>
        <Ionicons name={icon} size={hero ? 36 : 22} color="#E8F4FF" />
      </View>
      <View style={[styles.tileCopy, wide && !hero && styles.tileCopyWide]}>
        <Text style={[styles.tileTitle, hero && styles.tileTitleHero, wide && !hero && styles.tileTitleWide]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.tileSubtitle, hero && styles.tileSubtitleHero]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {count != null && count !== "" ? (
        <Text style={[styles.tileCount, hero && styles.tileCountHero, wide && !hero && styles.tileCountWide]}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function HubTileRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: hubColors.background,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 152, 236, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(56, 152, 236, 0.35)",
  },
  brandText: { flex: 1, minWidth: 0 },
  brand: {
    color: hubColors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: hubColors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 118,
    borderRadius: 20,
    padding: 14,
    backgroundColor: hubColors.tile,
    borderWidth: 1,
    borderColor: hubColors.tileBorder,
    overflow: "hidden",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tileWide: {
    flexGrow: 0,
    flexBasis: "auto",
    width: "100%",
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tileHero: {
    flexGrow: 0,
    flexBasis: "auto",
    width: "100%",
    minHeight: 176,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hubColors.tileHero,
    borderColor: "rgba(90, 180, 255, 0.38)",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconWrapWide: {
    marginRight: 2,
  },
  iconWrapHero: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 10,
  },
  tileCopy: {
    flexShrink: 1,
  },
  tileCopyWide: {
    flex: 1,
    minWidth: 0,
  },
  tileTitle: {
    color: hubColors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  tileTitleWide: {
    marginTop: 0,
    fontSize: 16,
  },
  tileTitleHero: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 0,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  tileSubtitle: {
    color: hubColors.textMuted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  tileSubtitleHero: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(232, 244, 255, 0.78)",
  },
  tileCount: {
    color: hubColors.accentSoft,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  tileCountWide: {
    marginTop: 0,
    fontSize: 24,
    marginLeft: "auto",
  },
  tileCountHero: {
    position: "absolute",
    top: 14,
    right: 16,
    fontSize: 18,
    color: "rgba(232, 244, 255, 0.85)",
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
