import { AppIcon } from "@/components/ui/AppIcon";
import { ApiError, createApi } from "@/data/api/client";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { config } from "@/core/config";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (config.googleWebClientId) {
      GoogleSignin.configure({
        webClientId: config.googleWebClientId,
      });
    }
  }, []);

  async function onLogin() {
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();
      if (!normalizedEmail || !normalizedPassword) {
        setErr("Enter email and password");
        return;
      }
      const api = createApi(() => null);
      const res = await api.post<{
        accessToken: string;
        user: { id: string; email: string; name: string; role: string };
      }>("/auth/login", { email: normalizedEmail, password: normalizedPassword });
      if (res.user.role !== "MEMBER") {
        logout();
        setErr("Only user accounts can log in on mobile");
        return;
      }
      setAuth(res.accessToken, {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        role: res.user.role,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErr(error.message || "Login failed");
      } else {
        setErr("Login failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErr("Enter your email first");
      return;
    }
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const api = createApi(() => null);
      const res = await api.post<{ message?: string }>("/auth/forgot-password-request", {
        email: normalizedEmail,
      });
      setInfo(res.message ?? "Request sent to admin.");
    } catch (error) {
      if (error instanceof ApiError) {
        setErr(error.message || "Failed to send request");
      } else {
        setErr("Failed to send request");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + tokens.space[3] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { paddingTop: insets.top + tokens.space[4] }]}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>RK</Text>
          </View>
          <Text style={styles.heroKicker}>Reckon</Text>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSub}>
            Sign in to continue managing your workspace with a calm, focused experience.
          </Text>
        </View>

        <View style={styles.formWrap}>
          <View style={styles.card}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.cardHint}>Use your credentials to access your account.</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor={tokens.color.placeholder}
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                placeholder="Enter your password"
                placeholderTextColor={tokens.color.placeholder}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                style={({ pressed }) => [styles.eyeBtn, pressed && styles.passwordTogglePressed]}
                onPress={() => setShowPassword((v) => !v)}
              >
                <AppIcon
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={tokens.color.muted}
                />
              </Pressable>
            </View>
            <Pressable style={styles.forgotWrap} onPress={onForgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            {info ? <Text style={styles.info}>{info}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.btn, pressed && !busy && styles.btnPressed]}
              onPress={onLogin}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={tokens.color.onAccent} />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: tokens.color.sidebar,
    paddingHorizontal: tokens.space[3],
    paddingBottom: tokens.space[4],
    alignItems: "flex-start",
  },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.sidebarElevated,
    borderWidth: 1,
    borderColor: tokens.color.sidebarBorder,
    marginBottom: tokens.space[2],
  },
  heroBadgeText: {
    fontSize: 14,
    color: tokens.color.sidebarText,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heroKicker: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.sidebarAccent,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  heroSub: {
    marginTop: 10,
    fontSize: tokens.textSize.small,
    color: tokens.color.sidebarMuted,
    lineHeight: 20,
    maxWidth: 320,
  },
  formWrap: {
    marginTop: -tokens.space[3],
    paddingHorizontal: tokens.space[3],
  },
  card: {
    borderRadius: tokens.radius.xl,
    padding: tokens.space[3],
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.elevated,
    gap: 10,
  },
  title: {
    fontSize: tokens.textSize.title,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.3,
  },
  cardHint: {
    fontSize: tokens.textSize.small,
    color: tokens.color.muted,
    marginBottom: 4,
  },
  label: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: tokens.space[1],
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 14,
    fontSize: tokens.textSize.body,
    backgroundColor: tokens.color.panel,
    color: tokens.color.text,
  },
  passwordWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 14,
    fontSize: tokens.textSize.body,
    color: tokens.color.text,
  },
  eyeBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotWrap: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  forgotText: {
    color: tokens.color.text,
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
  },
  err: {
    color: tokens.color.negative,
    fontSize: tokens.textSize.small,
    fontWeight: "600",
    marginTop: tokens.space[1],
  },
  info: {
    color: tokens.color.muted,
    fontSize: tokens.textSize.small,
    fontWeight: "600",
    marginTop: tokens.space[1],
  },
  passwordTogglePressed: { opacity: 0.8 },
  btn: {
    marginTop: tokens.space[2],
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.md,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
    ...tokens.shadow.card,
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: tokens.color.onAccent, fontWeight: "600", fontSize: tokens.textSize.body },
});
