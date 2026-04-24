import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

export type InsightBarDatum = { id: string; label: string; value: number; displayValue: string };

type Props = {
  data: InsightBarDatum[];
  title?: string;
  emptyLabel?: string;
};

const BAR_COLORS = [
  tokens.color.accent,
  "#6366F1",
  "#0D9488",
  "#D97706",
  "#7C3AED",
  "#64748B",
];

export const InsightBars = React.memo(function InsightBars({ data, title, emptyLabel = "No data for this period" }: Props) {
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
          return (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.label} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.value}>{row.displayValue}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
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
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space[1] },
  label: { flex: 1, fontSize: tokens.textSize.small, color: tokens.color.text, fontWeight: "500" },
  value: { fontSize: tokens.textSize.caption, color: tokens.color.muted, fontWeight: "600", fontVariant: ["tabular-nums"] },
  track: {
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.panelMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: tokens.radius.pill,
  },
  empty: { fontSize: tokens.textSize.small, color: tokens.color.muted },
});
