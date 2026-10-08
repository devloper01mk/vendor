import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { tokens } from "@/theme/tokens";

type SectionLabelProps = {
  children: string;
  style?: ViewStyle;
};

export const SectionLabel = React.memo(function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 2,
    marginTop: tokens.space[1],
    marginBottom: 6,
  },
  text: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
