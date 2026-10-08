import { CardContainer } from "@/components/ui/CardContainer";
import { tokens } from "@/theme/tokens";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export const ConfirmDialog = React.memo(function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" />
        <CardContainer style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                destructive ? styles.dangerBtn : styles.confirmBtn,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
            >
              <Text style={destructive ? styles.dangerText : styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </CardContainer>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.space[3],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.color.overlay,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    gap: tokens.space[2],
    padding: tokens.space[3],
    ...tokens.shadow.elevated,
  },
  title: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "700",
    color: tokens.color.ink,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: tokens.textSize.body,
    lineHeight: 22,
    color: tokens.color.muted,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.space[1],
    marginTop: tokens.space[1],
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space[2],
  },
  cancelBtn: {
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  confirmBtn: {
    backgroundColor: tokens.color.sidebar,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.sidebarBorder,
  },
  dangerBtn: {
    backgroundColor: tokens.color.negativeMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.negative,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  cancelText: {
    fontSize: tokens.textSize.body,
    fontWeight: "600",
    color: tokens.color.text,
  },
  confirmText: {
    fontSize: tokens.textSize.body,
    fontWeight: "600",
    color: tokens.color.sidebarText,
  },
  dangerText: {
    fontSize: tokens.textSize.body,
    fontWeight: "600",
    color: tokens.color.negative,
  },
});
