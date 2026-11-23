import { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/shared/theme/colors";

type Point = { x: number; y: number };
type Stroke = Point[];

function strokeToPath(stroke: Stroke): string {
  if (stroke.length === 0) return "";
  const [first, ...rest] = stroke;
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (const point of rest) {
    d += ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }
  return d;
}

/** Builds a compact SVG document of the ink strokes (Traizr-style signature canvas). */
export function strokesToSvgBase64(strokes: Stroke[], width: number, height: number): string | null {
  const paths = strokes.map(strokeToPath).filter(Boolean);
  if (paths.length === 0 || width <= 0 || height <= 0) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">${paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#111827" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("")}</svg>`;

  // RN btoa is available in Hermes / Expo; fall back to manual encoding if needed.
  try {
    // eslint-disable-next-line no-undef
    return btoa(svg);
  } catch {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let str = svg;
    let output = "";
    for (let i = 0; i < str.length; i += 3) {
      const a = str.charCodeAt(i);
      const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
      const bitmap = (a << 16) | (b << 8) | c;
      output +=
        chars[(bitmap >> 18) & 63] +
        chars[(bitmap >> 12) & 63] +
        (i + 1 < str.length ? chars[(bitmap >> 6) & 63] : "=") +
        (i + 2 < str.length ? chars[bitmap & 63] : "=");
    }
    return output;
  }
}

type Props = {
  onChange: (payload: { strokes: Stroke[]; width: number; height: number; empty: boolean }) => void;
};

export function SignaturePad({ onChange }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const currentStroke = useRef<Stroke>([]);
  const strokesRef = useRef<Stroke[]>([]);

  const emit = useCallback(
    (next: Stroke[], width: number, height: number) => {
      onChange({ strokes: next, width, height, empty: next.length === 0 });
    },
    [onChange],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentStroke.current = [{ x: locationX, y: locationY }];
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentStroke.current = [...currentStroke.current, { x: locationX, y: locationY }];
          const preview = [...strokesRef.current, currentStroke.current];
          setStrokes(preview);
        },
        onPanResponderRelease: () => {
          if (currentStroke.current.length === 0) return;
          const next = [...strokesRef.current, currentStroke.current];
          strokesRef.current = next;
          currentStroke.current = [];
          setStrokes(next);
          emit(next, size.width, size.height);
        },
      }),
    [emit, size.height, size.width],
  );

  function clear() {
    strokesRef.current = [];
    currentStroke.current = [];
    setStrokes([]);
    emit([], size.width, size.height);
  }

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>SIGNATURE</Text>
        <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear signature">
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>
      <View style={styles.pad} onLayout={onLayout} {...panResponder.panHandlers}>
        {strokes.length === 0 ? (
          <Text style={styles.placeholder}>Resident signs here</Text>
        ) : null}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          {strokes.map((stroke, index) => (
            <Path
              key={`stroke-${index}`}
              d={strokeToPath(stroke)}
              stroke="#111827"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 1.2,
  },
  clear: { fontSize: 12, fontWeight: "700", color: colors.primary },
  pad: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  placeholder: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "600",
  },
});
