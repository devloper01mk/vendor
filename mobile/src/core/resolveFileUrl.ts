import { config } from "./config";

/** Rewrites backend file URLs so uploads open on device (adb reverse / LAN API host). */
export function resolveFileUrl(fileUrl: string): string {
  if (!fileUrl.trim()) return fileUrl;

  if (!fileUrl.startsWith("http")) {
    const base = config.apiUrl.replace(/\/$/, "");
    return `${base}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
  }

  try {
    const api = new URL(config.apiUrl);
    const file = new URL(fileUrl);
    const localHosts = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);
    if (localHosts.has(file.hostname)) {
      file.hostname = api.hostname;
      file.port = api.port;
      file.protocol = api.protocol;
      return file.href;
    }
  } catch {
    // keep original URL
  }

  return fileUrl;
}
