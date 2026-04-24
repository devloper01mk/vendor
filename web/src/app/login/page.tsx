"use client";

import { login } from "@/features/auth/api";
import { DEFAULT_LOGIN_EMAIL, DEFAULT_LOGIN_PASSWORD } from "@/features/auth/defaults";
import { useAuthStore } from "@/features/auth/auth.store";
import { getBackendPublicUrl } from "@/core/config";
import { ApiError } from "@/core/api/http";
import { useApi } from "@/core/use-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const api = useApi();
  const [email, setEmail] = useState(DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_LOGIN_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await login(api, email, password);
      setAuth(res.accessToken, {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        role: res.user.role,
      });
      router.push("/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.message);
      } else if (e instanceof TypeError) {
        setErr(
          `Cannot reach the API. Start the backend: cd backend && npm run start:dev (expected at ${getBackendPublicUrl()}). From repo root: npm run dev`,
        );
      } else {
        setErr("Sign-in failed. Check email and password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-10 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted">Vendor & site expense workspace</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-canvas p-6 shadow-sm">
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Email</span>
          <input
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-ink/10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Password</span>
          <div className="space-y-1">
            <input
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-ink/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="text-xs font-medium text-ink/80 underline-offset-2 hover:underline"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>
        </label>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Continue"}
        </button>
        <div className="relative py-2 text-center text-xs text-muted before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-line before:content-['']">
          <span className="relative bg-canvas px-2">or</span>
        </div>
        <a
          href={`${getBackendPublicUrl()}/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-medium text-ink hover:bg-line/50"
        >
          Continue with Google
        </a>
        <p className="text-center text-xs text-muted">
          Form uses seed defaults. Account head:{" "}
          <code className="rounded bg-line/60 px-1">accounts@example.com</code> /{" "}
          <code className="rounded bg-line/60 px-1">Account12345!</code>
        </p>
      </form>
      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/dashboard" className="underline">
          Skip preview
        </Link>{" "}
        — requires session for data
      </p>
    </main>
  );
}
