"use client";

import { login } from "@/features/auth/api";
import { DEFAULT_LOGIN_EMAIL, DEFAULT_LOGIN_PASSWORD } from "@/features/auth/defaults";
import { useAuthStore } from "@/features/auth/auth.store";
import { getBackendPublicUrl } from "@/core/config";
import { ApiError } from "@/core/api/http";
import { useApi } from "@/core/use-api";
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
    <main className="min-h-screen bg-[#F6F3EE]">
      <div className="grid min-h-screen lg:grid-cols-[44%_56%]">
        <section className="hidden bg-[#151515] lg:flex lg:items-center lg:justify-center">
          <div className="mx-auto w-full max-w-sm px-10">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#C8B693]">Reckon</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">Welcome Back</h1>
            <p className="mt-3 text-sm leading-6 text-[#B8B8B8]">
              Sign in to continue managing your workspace with a calm and focused experience.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-[#E5DED3] bg-white p-7 shadow-[0_2px_10px_rgba(21,21,21,0.06)] sm:p-8">
            <div className="mb-7">
              <h2 className="text-3xl font-semibold tracking-tight text-[#2A2A2A]">Sign In</h2>
              <p className="mt-2 text-sm text-[#7A7A7A]">Use your credentials to access your account.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-[#4A4A4A]">Email</span>
                <input
                  className="w-full rounded-lg border border-[#E5DED3] bg-white px-3.5 py-2.5 text-[#2A2A2A] outline-none transition focus:border-[#C8B693] focus:ring-2 focus:ring-[#C8B693]/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-[#4A4A4A]">Password</span>
                <input
                  className="w-full rounded-lg border border-[#E5DED3] bg-white px-3.5 py-2.5 text-[#2A2A2A] outline-none transition focus:border-[#C8B693] focus:ring-2 focus:ring-[#C8B693]/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />
              </label>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-[#7A7A7A] transition hover:text-[#2A2A2A]"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide password" : "Show password"}
                </button>
                <a href={`${getBackendPublicUrl()}/auth/google`} className="text-[#7A7A7A] transition hover:text-[#2A2A2A]">
                  Forgot password?
                </a>
              </div>

              {err ? <p className="text-sm text-red-600">{err}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#C8B693] py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
