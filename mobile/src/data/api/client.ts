import { config } from "@/core/config";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApi(getToken: () => string | null) {
  const REQUEST_TIMEOUT_MS = 12000;
  function buildUrl(path: string, query?: Record<string, string | undefined>) {
    const base = path.startsWith("http") ? path : `${config.apiUrl}${path}`;
    if (!query) return base;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === "") continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    if (!parts.length) return base;
    return `${base}${base.includes("?") ? "&" : "?"}${parts.join("&")}`;
  }

  async function req<T>(
    method: string,
    path: string,
    opts?: { query?: Record<string, string | undefined>; body?: unknown },
  ): Promise<T> {
    const url = buildUrl(path, opts?.query);
    const token = getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "x-client-platform": "mobile",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: string | undefined;
    if (opts?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { method, headers, body, signal: controller.signal });
    } catch (error) {
      const isTimeout =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";
      throw new ApiError(isTimeout ? "Request timed out. Check backend connection." : "Unable to reach server.", 0);
    } finally {
      clearTimeout(timeout);
    }
    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = (await res.json()) as { message?: unknown };
        if (typeof j.message === "string") msg = j.message;
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
    patch: <T>(path: string, body?: unknown) => req<T>("PATCH", path, { body }),
  };
}
