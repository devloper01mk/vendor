import { config } from "@/core/config";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApi(getToken: () => string | null) {
  const REQUEST_TIMEOUT_MS = 12000;
  const logEnabled = __DEV__;

  function safePreview(value: unknown, limit = 1200) {
    if (value === undefined) return undefined;
    try {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return text.length > limit ? `${text.slice(0, limit)}...<truncated>` : text;
    } catch {
      return "<unserializable>";
    }
  }

  function responseHeadersToObject(headers: Headers): Record<string, string> {
    const out: Record<string, string> = {};
    headers.forEach((value: string, key: string) => {
      out[key] = value;
    });
    return out;
  }

  function logApi(stage: string, details: Record<string, unknown>) {
    if (!logEnabled) return;
    console.log(`[API ${stage}]`, details);
  }

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
    const startedAt = Date.now();
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
    logApi("REQUEST", {
      method,
      url,
      query: opts?.query,
      headersSent: { ...headers, Authorization: token ? "Bearer <redacted>" : undefined },
      body: opts?.body !== undefined ? safePreview(opts?.body) : undefined,
    });
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
      logApi("NETWORK_ERROR", {
        method,
        url,
        durationMs: Date.now() - startedAt,
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(isTimeout ? "Request timed out. Check backend connection." : "Unable to reach server.", 0);
    } finally {
      clearTimeout(timeout);
    }
    const responseHeaders = responseHeadersToObject(res.headers);

    if (res.status === 204) {
      logApi("RESPONSE", {
        method,
        url,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
        responseHeaders,
        body: undefined,
      });
      return undefined as T;
    }

    const raw = await res.text();
    let parsed: unknown = undefined;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    logApi("RESPONSE", {
      method,
      url,
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
      responseHeaders,
      body: safePreview(parsed),
    });

    if (!res.ok) {
      let msg = res.statusText;
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        const maybeMessage = (parsed as { message?: unknown }).message;
        if (typeof maybeMessage === "string") msg = maybeMessage;
      }
      throw new ApiError(msg, res.status);
    }
    return parsed as T;
  }

  return {
    get: <T>(path: string, query?: Record<string, string | undefined>) =>
      req<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown) => req<T>("POST", path, { body }),
    patch: <T>(path: string, body?: unknown) => req<T>("PATCH", path, { body }),
  };
}
