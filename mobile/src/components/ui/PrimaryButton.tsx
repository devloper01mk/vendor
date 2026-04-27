import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "@/theme/tokens";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "outline";
};

export const PrimaryButton = React.memo(function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "solid",
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "outline" ? styles.outline : styles.solid,
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? tokens.color.accent : tokens.color.onAccent} />
      ) : (
        <Text style={variant === "outline" ? styles.textOutline : styles.text}>{title}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: {
    marginTop: tokens.space[1],
    borderRadius: tokens.radius.lg,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space[2],
  },
  solid: {
    backgroundColor: tokens.color.accent,
    borderWidth: 1,
    borderColor: "#BFAC88",
  },
  outline: {
    backgroundColor: tokens.color.panel,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  btnDisabled: { opacity: 0.5 },
  text: {
    color: tokens.color.onAccent,
    fontSize: tokens.textSize.body,
    lineHeight: 22,
    fontWeight: "600",
  },
  textOutline: {
    color: tokens.color.accent,
    fontSize: tokens.textSize.body,
    lineHeight: 22,
    fontWeight: "600",
  },
});
