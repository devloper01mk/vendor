import { NativeModules } from "react-native";

/**
 * API base URL for the Nest backend.
 * - Dev default is localhost:4000.
 * - Android devices rely on adb reverse (configured in run-from-package script).
 * - Override MANUAL_DEV_API_HOST for LAN testing if needed.
 */
const MANUAL_DEV_API_URL = "https://api.reckon.cronberry.com";
const MANUAL_DEV_API_HOST = "localhost";

function getMetroHost() {
  if (!__DEV__) return null;
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
    if (!scriptURL) return null;
    const host = new URL(scriptURL).hostname;
    return host || null;
  } catch {
    return null;
  }
}

const defaultHost = "localhost";
const detectedHost = getMetroHost();
const normalizedDetectedHost = detectedHost?.replace(/^\[|\]$/g, "") ?? null;
const apiHost =
  MANUAL_DEV_API_HOST.trim() ||
  normalizedDetectedHost ||
  defaultHost;

export const config = {
  apiUrl: __DEV__ ? MANUAL_DEV_API_URL.trim() || `http://${apiHost}:4000` : "https://api.reckon.cronberry.com",
  // Google OAuth Web client ID (required for Google Sign-In idToken on mobile)
  googleWebClientId: "",
} as const;
