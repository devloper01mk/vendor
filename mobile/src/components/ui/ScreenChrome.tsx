import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenChromeProps = {
  title: string;
  onSettingsPress?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
};

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return "RK";
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const ScreenChrome = React.memo(function ScreenChrome({
  title,
  onSettingsPress,
  children,
  style,
}: ScreenChromeProps) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const initials = initialsFromName(user?.name);

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, tokens.space[2]) }, style]}>
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>{title}</Text>
        <View style={styles.titleActions}>
          <Pressable
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
            onPress={onSettingsPress}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>
      </View>

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.space[2],
    paddingBottom: tokens.space[2],
    backgroundColor: tokens.color.background,
    gap: tokens.space[2],
    zIndex: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.space[2],
  },
  pageTitle: {
    flex: 1,
    fontSize: tokens.textSize.hero,
    lineHeight: 34,
    fontWeight: "700",
    color: tokens.color.ink,
    letterSpacing: -0.6,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  avatarPressed: {
    opacity: 0.9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.sidebar,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.sidebarText,
  },
});
