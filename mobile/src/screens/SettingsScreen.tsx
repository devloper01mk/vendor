import { CardContainer } from "@/components/ui/CardContainer";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.wrap,
        { paddingTop: tokens.space[2], paddingBottom: insets.bottom + tokens.space[4] },
      ]}
    >
      <CardContainer style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{user?.name ?? "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{user?.role ?? "-"}</Text>
        </View>
      </CardContainer>

      <CardContainer style={styles.card}>
        <Text style={styles.title}>Account</Text>
        <PrimaryButton title="Logout" onPress={logout} />
      </CardContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.space[2],
    gap: tokens.space[2],
    backgroundColor: tokens.color.background,
  },
  card: { gap: tokens.space[1] },
  title: {
    fontSize: tokens.textSize.subtitle,
    lineHeight: 24,
    fontWeight: "700",
    color: tokens.color.text,
    marginBottom: tokens.space[1],
  },
  row: {
    paddingVertical: tokens.space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.border,
  },
  label: {
    fontSize: tokens.textSize.caption,
    color: tokens.color.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  value: {
    marginTop: 4,
    fontSize: tokens.textSize.body,
    color: tokens.color.text,
    fontWeight: "500",
  },
});
