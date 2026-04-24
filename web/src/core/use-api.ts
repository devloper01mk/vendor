"use client";

import { createApi } from "@/core/api/http";
import { useAuthStore } from "@/features/auth/auth.store";
import { useMemo } from "react";

export function useApi() {
  const token = useAuthStore((s) => s.token);
  return useMemo(() => createApi(() => token), [token]);
}
