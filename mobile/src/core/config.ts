import { NativeModules, Platform } from "react-native";
import { DEV_BACKEND_PORT } from "./devHost.generated";

/**
 * API base URL for the Nest backend.
 * - Release builds use PRODUCTION_API_BASE.
 * - Debug Android physical device: 127.0.0.1 (adb reverse via run-from-package.js).
 *   Set MANUAL_DEV_API_URL to http://<mac-lan-ip>:4001 for Wi‑Fi-only debugging.
 * - Debug Android emulator: 10.0.2.2 (host loopback alias).
 * - Debug iOS simulator: 127.0.0.1
 */
export const PRODUCTION_API_BASE = "https://api.reckon.cronberry.com";

/** Override dev base URL entirely (optional). */
const MANUAL_DEV_API_URL = "";

function isAndroidEmulator(): boolean {
  if (Platform.OS !== "android") return false;
  const constants = NativeModules.PlatformConstants as
    | { Model?: string; Fingerprint?: string; Brand?: string }
    | undefined;
  const model = constants?.Model ?? "";
  const fingerprint = constants?.Fingerprint ?? "";
  return (
    model.includes("sdk_gphone") ||
    model.includes("Emulator") ||
    model.includes("Android SDK built for") ||
    fingerprint.includes("generic") ||
    fingerprint.includes("sdk_gphone")
  );
}

function resolveDevApiBase(): string {
  if (MANUAL_DEV_API_URL.trim()) return MANUAL_DEV_API_URL.trim();

  const port = DEV_BACKEND_PORT;
  if (Platform.OS === "android") {
    const host = isAndroidEmulator() ? "10.0.2.2" : "127.0.0.1";
    return `http://${host}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
}

export const DEV_API_BASE = resolveDevApiBase();

export const config = {
  apiUrl: __DEV__ ? DEV_API_BASE : PRODUCTION_API_BASE,
  googleWebClientId: "",
} as const;
