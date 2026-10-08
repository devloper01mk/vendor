import { formatRupee, formatRupeeWithSign } from "@/core/formatRupee";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type ScaledAmountTextProps = {
  children: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Base font size before shrink */
  baseSize?: number;
  minimumFontScale?: number;
  align?: "left" | "right" | "center";
  /** When false, shows the raw value (e.g. counts). Default: true */
  currency?: boolean;
  sign?: "+" | "-" | "";
};

function fitFontSize(text: string, baseSize: number, minimumFontScale: number): number {
  const len = text.length;
  const minSize = baseSize * minimumFontScale;
  if (len <= 6) return baseSize;
  if (len <= 8) return Math.max(minSize, baseSize * 0.88);
  if (len <= 10) return Math.max(minSize, baseSize * 0.76);
  if (len <= 12) return Math.max(minSize, baseSize * 0.66);
  if (len <= 14) return Math.max(minSize, baseSize * 0.58);
  if (len <= 18) return Math.max(minSize, baseSize * 0.5);
  return minSize;
}

/** Shrinks font by length so amounts stay on one line. */
export const ScaledAmountText = React.memo(function ScaledAmountText({
  children,
  style,
  containerStyle,
  baseSize = 22,
  minimumFontScale = 0.5,
  align = "left",
  currency = true,
  sign = "",
}: ScaledAmountTextProps) {
  const raw = children?.trim() ? children : "—";
  const display = useMemo(() => {
    if (!currency) return raw;
    return sign ? formatRupeeWithSign(raw, sign) : formatRupee(raw);
  }, [raw, currency, sign]);

  const fontSize = useMemo(
    () => fitFontSize(display, baseSize, minimumFontScale),
    [display, baseSize, minimumFontScale],
  );

  const alignContainerStyle = useMemo((): ViewStyle | undefined => {
    if (align === "right") return styles.alignRightContainer;
    if (align === "center") return styles.alignCenterContainer;
    return undefined;
  }, [align]);

  return (
    <View style={[styles.container, alignContainerStyle, containerStyle]}>
      <Text
        style={[
          styles.text,
          { fontSize, lineHeight: Math.round(fontSize * 1.2), textAlign: align },
          align !== "left" ? styles.fullWidth : null,
          style,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {display}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    flexShrink: 1,
  },
  alignRightContainer: {
    alignSelf: "stretch",
    alignItems: "flex-end",
  },
  alignCenterContainer: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  fullWidth: {
    width: "100%",
  },
  text: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
