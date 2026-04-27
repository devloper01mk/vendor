import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

type ListItemProps = {
  title: string;
  subtitle: string;
  amountLabel?: string;
  amountTone?: "default" | "positive" | "negative" | "muted";
  isSelected?: boolean;
  rightSlot?: React.ReactNode;
  onPress: () => void;
  /** Single character or emoji for the leading tile; defaults to first letter of title */
  leadingGlyph?: string;
  showChevron?: boolean;
};

export const ListItem = React.memo(function ListItem({
  title,
  subtitle,
  amountLabel,
  amountTone = "negative",
  isSelected,
  rightSlot,
  onPress,
  leadingGlyph,
  showChevron = true,
}: ListItemProps) {
  const glyph = leadingGlyph?.trim() || title.trim().charAt(0).toUpperCase() || "•";

  const amountStyle =
    amountTone === "positive"
      ? styles.amountPositive
      : amountTone === "muted"
        ? styles.amountMuted
        : amountTone === "default"
          ? styles.amountDefault
          : styles.amountNegative;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, isSelected && styles.selected, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.leading}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{glyph}</Text>
        </View>
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        {amountLabel ? <Text style={[styles.amount, amountStyle]}>{amountLabel}</Text> : null}
        <View style={styles.rightActions}>
          {rightSlot}
          {showChevron ? <Text style={styles.chevron}>›</Text> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    padding: tokens.space[2],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[1],
    ...tokens.shadow.card,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  selected: {
    borderColor: "#D2C1A2",
    backgroundColor: tokens.color.accentMuted,
  },
  leading: { justifyContent: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "700",
    color: tokens.color.accent,
  },
  middle: { flex: 1, gap: 4, minWidth: 0 },
  right: { alignItems: "flex-end", gap: 6, maxWidth: "36%" },
  rightActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    fontSize: tokens.textSize.body,
    lineHeight: 22,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: tokens.textSize.caption,
    lineHeight: 16,
    color: tokens.color.muted,
  },
  amount: {
    fontSize: tokens.textSize.small,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  amountDefault: { color: tokens.color.text },
  amountPositive: { color: tokens.color.positive },
  amountNegative: { color: tokens.color.negative },
  amountMuted: { color: tokens.color.muted },
  chevron: {
    fontSize: 22,
    color: tokens.color.muted,
    fontWeight: "300",
    marginLeft: 2,
    lineHeight: 24,
  },
});
