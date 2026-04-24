import { getApiBaseUrl } from "@/core/config";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApi(getToken: () => string | null) {
  async function req<T>(
    method: string,
    path: string,
    opts?: { query?: Record<string, string | undefined>; body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const base = getApiBaseUrl();
    const url = new URL(
      path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`,
    );
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    const token = getToken();
    const headers: Record<string, string> = { Accept: "application/json", ...(opts?.headers ?? {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: string | undefined;
    if (opts?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    const res = await fetch(url.toString(), { method, headers, body, cache: "no-store" });
    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = (await res.json()) as { message?: unknown };
        if (typeof j.message === "string") msg = j.message;
        else if (Array.isArray(j.message)) msg = j.message.join(", ");
      } catch {
        /* ignore */
      }
      throw new ApiError(msg, res.status);
    }
    return (await res.json()) as T;
  }

  return {
    get: <T>(path: string, query?: Record<string, string | undefined>) =>
      req<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown) => req<T>("POST", path, { body }),
    postWithHeaders: <T>(path: string, body: unknown, headers: Record<string, string>) =>
      req<T>("POST", path, { body, headers }),
    patch: <T>(path: string, body?: unknown) => req<T>("PATCH", path, { body }),
    delete: <T>(path: string) => req<T>("DELETE", path),
    postMultipart: async <T>(path: string, form: FormData) => {
      const base = getApiBaseUrl();
      const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
      const token = getToken();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, { method: "POST", headers, body: form, cache: "no-store" });
      if (!res.ok) throw new ApiError(await res.text(), res.status);
      return (await res.json()) as T;
    },
  };
}
