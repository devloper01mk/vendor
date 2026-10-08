import { tokens } from "@/theme/tokens";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";

type SnackbarProps = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function Snackbar({ message, onDismiss, durationMs = 5000 }: SnackbarProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (!message) {
      opacity.setValue(0);
      translateY.setValue(-16);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(-16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.bar, { opacity, transform: [{ translateY }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name="alert-circle" size={18} color={tokens.color.negative} />
      <Text style={styles.text} numberOfLines={4}>
        {message}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color={tokens.color.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: tokens.space[1],
    left: tokens.space[2],
    right: tokens.space[2],
    zIndex: 100,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.space[1],
    paddingHorizontal: tokens.space[2],
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.negative,
    ...tokens.shadow.card,
  },
  text: {
    flex: 1,
    fontSize: tokens.textSize.small,
    fontWeight: "600",
    color: tokens.color.negative,
    lineHeight: 18,
  },
  dismiss: {
    paddingTop: 1,
  },
});
