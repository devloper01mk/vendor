import type { createApi } from "@/core/api/http";

type Api = ReturnType<typeof createApi>;

export async function login(api: Api, email: string, password: string) {
  return api.postWithHeaders<{ user: { id: string; email: string; name: string; role: string }; accessToken: string }>(
    "/auth/login",
    { email, password },
    { "x-client-platform": "web" },
  );
}
