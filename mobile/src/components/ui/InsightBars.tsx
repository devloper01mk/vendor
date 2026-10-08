import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScaledAmountText } from "@/components/ui/ScaledAmountText";
import { tokens } from "@/theme/tokens";

export type InsightBarDatum = { id: string; label: string; value: number; displayValue: string };

type Props = {
  data: InsightBarDatum[];
  title?: string;
  emptyLabel?: string;
  onPressItem?: (id: string) => void;
};

const BAR_COLORS = [tokens.color.accent, "#8E7E5B", "#BBAA86", "#D1C3A7"];

export const InsightBars = React.memo(function InsightBars({
  data,
  title,
  emptyLabel = "No data for this period",
  onPressItem,
}: Props) {
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  if (!data.length) {
    return (
      <View style={styles.emptyWrap}>
        {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
        <Text style={styles.empty}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.bars}>
        {data.map((row, i) => {
          const pct = row.value <= 0 ? 0 : Math.max(8, (row.value / max) * 100);
          const color = BAR_COLORS[i % BAR_COLORS.length];
          const content = (
            <>
              <View style={styles.rowTop}>
                <Text style={styles.label} numberOfLines={1}>
                  {row.label}
                </Text>
                <ScaledAmountText
                  baseSize={12}
                  minimumFontScale={0.6}
                  align="right"
                  containerStyle={styles.valueWrap}
                  style={styles.value}
                >
                  {row.displayValue}
                </ScaledAmountText>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </>
          );
          if (onPressItem) {
            return (
              <Pressable
                key={row.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onPressItem(row.id)}
              >
                {content}
              </Pressable>
            );
          }
          return (
            <View key={row.id} style={styles.row}>
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  emptyWrap: { gap: tokens.space[1] },
  sectionTitle: {
    fontSize: tokens.textSize.subtitle,
    lineHeight: 24,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  bars: { gap: tokens.space[2] },
  row: { gap: 6 },
  rowPressed: { opacity: 0.85 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space[1] },
  label: { flex: 1, minWidth: 0, fontSize: tokens.textSize.small, color: tokens.color.text, fontWeight: "500" },
  valueWrap: {
    flexShrink: 1,
    maxWidth: "42%",
    minWidth: 48,
  },
  value: {
    color: tokens.color.muted,
  },
  track: {
    height: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#F0EAE1",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: tokens.radius.pill,
  },
  empty: { fontSize: tokens.textSize.small, color: tokens.color.muted },
});
