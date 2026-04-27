import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { tokens } from "@/theme/tokens";

export const CardContainer = React.memo(function CardContainer({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    padding: tokens.space[2],
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    ...tokens.shadow.card,
  },
});
