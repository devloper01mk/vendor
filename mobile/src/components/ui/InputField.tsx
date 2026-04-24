import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { tokens } from "@/theme/tokens";

type InputFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
};

export const InputField = React.memo(function InputField({
  label,
  style,
  error,
  helperText,
  containerStyle,
  ...rest
}: InputFieldProps) {
  const showHint = error || helperText;
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={tokens.color.muted}
      />
      {showHint ? <Text style={error ? styles.error : styles.helper}>{error ?? helperText}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: tokens.space[2] },
  label: {
    fontSize: tokens.textSize.caption,
    lineHeight: 16,
    fontWeight: "600",
    color: tokens.color.muted,
    marginBottom: tokens.space[1],
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    minHeight: 48,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 12,
    color: tokens.color.text,
    fontSize: tokens.textSize.body,
    lineHeight: 22,
  },
  inputError: {
    borderColor: tokens.color.negative,
    backgroundColor: tokens.color.negativeMuted,
  },
  helper: {
    marginTop: 6,
    fontSize: tokens.textSize.caption,
    color: tokens.color.muted,
    lineHeight: 16,
  },
  error: {
    marginTop: 6,
    fontSize: tokens.textSize.caption,
    color: tokens.color.negative,
    lineHeight: 16,
    fontWeight: "500",
  },
});
