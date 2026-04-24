import { ApiError, createApi } from "@/data/api/client";
import { config } from "@/core/config";
import { DEFAULT_LOGIN_EMAIL, DEFAULT_LOGIN_PASSWORD } from "@/features/auth/defaults";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [email, setEmail] = useState(DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_LOGIN_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (config.googleWebClientId) {
      GoogleSignin.configure({
        webClientId: config.googleWebClientId,
      });
    }
  }, []);

  async function onLogin() {
    setErr(null);
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

  async function onGoogleLogin() {
    setErr(null);
    setBusy(true);
    try {
      if (!config.googleWebClientId) {
        setErr("Google login is not configured");
        return;
      }

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        setErr("Google did not return an ID token");
        return;
      }

      const api = createApi(() => null);
      const res = await api.post<{
        accessToken: string;
        user: { id: string; email: string; name: string; role: string };
      }>("/auth/google/token", { idToken });

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
      if (error instanceof ApiError && error.status === 0) {
        setErr(error.message);
      } else {
        setErr("Google login failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.brand}>
        <Text style={styles.brandMark}>{"\u25C9"}</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.sub}>Vendor & site expenses</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@company.com"
          placeholderTextColor={tokens.color.muted}
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          placeholderTextColor={tokens.color.muted}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}
          onPress={() => setShowPassword((v) => !v)}
        >
          <Text style={styles.passwordToggleText}>{showPassword ? "Hide password" : "Show password"}</Text>
        </Pressable>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && !busy && styles.btnPressed]}
          onPress={onLogin}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={tokens.color.onAccent} /> : <Text style={styles.btnText}>Continue</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.googleBtn, pressed && !busy && styles.googlePressed]}
          onPress={onGoogleLogin}
          disabled={busy}
        >
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    padding: tokens.space[3],
    backgroundColor: tokens.color.background,
  },
  brand: { marginBottom: tokens.space[3], alignItems: "center" },
  brandMark: {
    fontSize: 28,
    color: tokens.color.accent,
    marginBottom: tokens.space[2],
  },
  title: {
    fontSize: tokens.textSize.hero,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.6,
  },
  sub: { marginTop: 6, fontSize: tokens.textSize.small, color: tokens.color.muted, fontWeight: "500" },
  card: {
    borderRadius: tokens.radius.xl,
    padding: tokens.space[3],
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.card,
    gap: tokens.space[1],
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
    backgroundColor: tokens.color.panelMuted,
    color: tokens.color.text,
  },
  err: { color: tokens.color.negative, fontSize: tokens.textSize.small, fontWeight: "600", marginTop: tokens.space[1] },
  passwordToggle: {
    alignSelf: "flex-end",
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  passwordTogglePressed: { opacity: 0.8 },
  passwordToggleText: { color: tokens.color.accent, fontSize: tokens.textSize.caption, fontWeight: "600" },
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
  googleBtn: {
    backgroundColor: tokens.color.panel,
    borderRadius: tokens.radius.md,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.borderStrong,
  },
  googlePressed: { backgroundColor: tokens.color.panelMuted },
  googleBtnText: { color: tokens.color.text, fontWeight: "600", fontSize: tokens.textSize.body },
});
