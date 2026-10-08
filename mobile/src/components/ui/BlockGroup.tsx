import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { tokens } from "@/theme/tokens";

/** Notion-style grouped block — single white surface with internal dividers. */
export const BlockGroup = React.memo(function BlockGroup({ children, style, ...rest }: ViewProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View {...rest} style={[styles.group, style]}>
      {items.map((child, index) => (
        <View
          key={index}
          style={[styles.item, index < items.length - 1 ? styles.itemBorder : null]}
        >
          {child}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    overflow: "hidden",
    ...tokens.shadow.card,
  },
  item: {},
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.border,
  },
});
