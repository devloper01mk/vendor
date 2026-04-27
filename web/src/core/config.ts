/**
 * Browser API calls: use `/api-proxy` (Next rewrite → backend) unless `NEXT_PUBLIC_API_URL` is a full URL.
 * OAuth / Google redirect must hit the backend directly — use `getBackendPublicUrl()`.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const p = process.env.NEXT_PUBLIC_API_URL;
    if (p?.startsWith("http")) return p.replace(/\/$/, "");
    const path = (p ?? "/api-proxy").replace(/\/$/, "");
    return `${window.location.origin}${path}`;
  }
  return process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, "")
    : "https://api.reckon.cronberry.com";
}

/** Public backend origin for Google OAuth redirects (cannot go through Next proxy). */
export function getBackendPublicUrl(): string {
  const b = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.replace(/\/$/, "");
  if (b) return b;
  const p = process.env.NEXT_PUBLIC_API_URL;
  if (p?.startsWith("http")) return p.replace(/\/$/, "");
  return "https://api.reckon.cronberry.com";
}
