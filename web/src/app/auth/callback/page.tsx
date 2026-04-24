"use client";

import { useAuthStore } from "@/features/auth/auth.store";
import { jwtDecode } from "jwt-decode";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  name?: string;
};

function CallbackInner() {
  const router = useRouter();
  const search = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = search.get("accessToken");
    if (!token) {
      setErr("Missing token. Try signing in again.");
      return;
    }
    try {
      const payload = jwtDecode<JwtPayload>(token);
      setAuth(token, {
        id: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email.split("@")[0] ?? "User",
        role: payload.role,
      });
      router.replace("/dashboard");
    } catch {
      setErr("Invalid session token.");
    }
  }, [search, router, setAuth]);

  if (err) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p className="text-sm text-red-600">{err}</p>
        <a className="mt-4 text-sm text-ink underline" href="/login">
          Back to login
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
      <p className="text-sm text-muted">Completing sign-in…</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
