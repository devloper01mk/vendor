import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { createApi } from "@/data/api/client";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"profile" | "password" | "passcode" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await AsyncStorage.getItem("ve-mobile-passcode");
      if (!cancelled) setPasscode(v ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    if (!token) return;
    setBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      const me = await api.patch<{ id: string; email: string; name: string; role: string }>("/users/me", {
        name: name.trim(),
      });
      setUser(me);
      setStatus("Profile updated");
    } catch {
      setStatus("Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (!token || !currentPassword || !newPassword) {
      setStatus("Enter current and new password");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      await api.patch("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setStatus("Password updated");
    } catch {
      setStatus("Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  async function savePasscode() {
    if (!passcode.trim()) {
      setStatus("Enter passcode");
      return;
    }
    await AsyncStorage.setItem("ve-mobile-passcode", passcode.trim());
    setStatus("Passcode saved");
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.wrap,
        { paddingTop: tokens.space[2], paddingBottom: insets.bottom + tokens.space[4] },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      <CardContainer style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name ?? "A")
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{user?.name ?? "-"}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? "-"}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </CardContainer>

      <Text style={styles.sectionTitle}>Account</Text>
      <CardContainer style={styles.menuCard}>
        <MenuItem
          icon="◌"
          title="Profile Information"
          subtitle="Update your personal details"
          onPress={() => setPanel("profile")}
        />
        <MenuItem
          icon="⌕"
          title="Change Password"
          subtitle="Update your password"
          onPress={() => setPanel("password")}
        />
        <MenuItem icon="⌁" title="Passcode" subtitle="Manage app passcode" onPress={() => setPanel("passcode")} />
      </CardContainer>

      <Text style={styles.sectionTitle}>App & Support</Text>
      <CardContainer style={styles.menuCard}>
        <MenuItem icon="?" title="Help & Support" subtitle="Get help and contact support" onPress={() => {}} />
        <MenuItem icon="i" title="About App" subtitle="App version and information" onPress={() => {}} />
        <MenuItem icon="↪" title="Log Out" subtitle="Sign out from your account" onPress={logout} danger />
      </CardContainer>

      <Text style={styles.version}>Version 1.0.0</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setPanel(null)} />
          <CardContainer style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>
              {panel === "profile" ? "Profile Information" : panel === "password" ? "Change Password" : "Passcode"}
            </Text>
            {panel === "profile" ? (
              <>
                <InputField label="Name" value={name} onChangeText={setName} />
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{user?.email ?? "-"}</Text>
                </View>
                <PrimaryButton title="Update Profile" onPress={saveProfile} disabled={busy} loading={busy} />
              </>
            ) : null}
            {panel === "password" ? (
              <>
                <InputField label="Current Password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
                <InputField label="New Password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                <PrimaryButton title="Update Password" onPress={changePassword} disabled={busy} loading={busy} />
              </>
            ) : null}
            {panel === "passcode" ? (
              <>
                <InputField label="App Passcode" secureTextEntry value={passcode} onChangeText={setPasscode} />
                <PrimaryButton title="Save Passcode" onPress={savePasscode} />
              </>
            ) : null}
            <PrimaryButton title="Close" variant="outline" onPress={() => setPanel(null)} />
          </CardContainer>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  danger,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Text style={styles.menuIcon}>{icon}</Text>
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuTitle, danger ? styles.menuTitleDanger : null]}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.space[2],
    gap: tokens.space[2],
    backgroundColor: tokens.color.background,
  },
  headerRow: {
    paddingTop: 2,
  },
  screenTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[1],
    padding: tokens.space[2],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: tokens.color.onAccent,
    fontSize: 22,
    fontWeight: "700",
  },
  profileMeta: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "600", color: tokens.color.text },
  profileEmail: { marginTop: 2, fontSize: tokens.textSize.small, color: tokens.color.muted },
  sectionTitle: {
    fontSize: 30,
    fontWeight: "600",
    color: tokens.color.text,
    marginTop: 4,
  },
  menuCard: { paddingVertical: 0 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: tokens.space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.border,
    gap: tokens.space[1],
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: { color: "#8B7D64", fontSize: 14, fontWeight: "700" },
  menuTextWrap: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: "600", color: tokens.color.text },
  menuTitleDanger: { color: "#C94949" },
  menuSubtitle: { marginTop: 2, fontSize: tokens.textSize.small, color: tokens.color.muted },
  chevron: {
    fontSize: 24,
    lineHeight: 24,
    color: tokens.color.muted,
  },
  version: { textAlign: "center", color: tokens.color.muted, fontSize: tokens.textSize.small, marginTop: 4 },
  infoRow: {
    paddingVertical: tokens.space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.border,
  },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  sheetCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: tokens.space[3],
    gap: 6,
  },
  sheetTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "700",
    color: tokens.color.text,
    marginBottom: 6,
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
  status: {
    textAlign: "center",
    color: tokens.color.muted,
    fontSize: tokens.textSize.small,
  },
});
