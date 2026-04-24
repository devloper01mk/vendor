import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export const AppHeader = React.memo(function AppHeader({ title, subtitle, rightSlot }: AppHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.space[2],
    paddingTop: tokens.space[2],
    paddingBottom: tokens.space[1],
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.space[1],
  },
  left: { flex: 1 },
  right: { alignItems: "flex-end", paddingTop: 2 },
  title: {
    fontSize: tokens.textSize.hero,
    lineHeight: 34,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: tokens.textSize.small,
    lineHeight: 18,
    color: tokens.color.muted,
    fontWeight: "500",
  },
});
