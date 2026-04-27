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

  async function onGoogleLogin() {
    setErr(null);
    setInfo(null);
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
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>⌂</Text>
        </View>
        <Text style={styles.heroTitle}>Welcome Back!</Text>
        <Text style={styles.heroSub}>Sign in to continue to your account</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>
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
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            placeholder="Enter your password"
            placeholderTextColor={tokens.color.muted}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            style={({ pressed }) => [styles.eyeBtn, pressed && styles.passwordTogglePressed]}
            onPress={() => setShowPassword((v) => !v)}
          >
            <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
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
          {busy ? <ActivityIndicator color={tokens.color.onAccent} /> : <Text style={styles.btnText}>Continue</Text>}
        </Pressable>
        {/* <Pressable
          style={({ pressed }) => [styles.googleBtn, pressed && !busy && styles.googlePressed]}
          onPress={onGoogleLogin}
          disabled={busy}
        >
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable> */}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: tokens.space[3],
    backgroundColor: tokens.color.background,
    justifyContent: "center",
  },
  hero: {
    marginBottom: tokens.space[3],
    alignItems: "center",
    backgroundColor: "#F1EBDD",
    borderRadius: tokens.radius.xl,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[2],
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: tokens.color.border,
    marginBottom: 10,
  },
  heroBadgeText: { fontSize: 22, color: "#8F7E60", fontWeight: "700" },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.4,
  },
  heroSub: { marginTop: 4, fontSize: tokens.textSize.small, color: tokens.color.muted, fontWeight: "500" },
  title: {
    fontSize: tokens.textSize.title,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  card: {
    borderRadius: tokens.radius.xl,
    padding: tokens.space[3],
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.card,
    gap: 10,
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
  passwordWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panelMuted,
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
  eyeIcon: { color: tokens.color.muted, fontSize: 14 },
  forgotWrap: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  forgotText: {
    color: tokens.color.accent,
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
  },
  err: { color: tokens.color.negative, fontSize: tokens.textSize.small, fontWeight: "600", marginTop: tokens.space[1] },
  info: { color: tokens.color.muted, fontSize: tokens.textSize.small, fontWeight: "600", marginTop: tokens.space[1] },
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
