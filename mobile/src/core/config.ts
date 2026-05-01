import { NativeModules } from "react-native";

/**
 * API base URL for the Nest backend.
 * - Release builds always use PRODUCTION_API_BASE.
 * - In dev, set MANUAL_DEV_API_URL to "" to use http://HOST:4000 (see MANUAL_DEV_API_HOST / Metro).
 */
export const PRODUCTION_API_BASE = "https://api.reckon.cronberry.com";

const MANUAL_DEV_API_URL = PRODUCTION_API_BASE;
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
  apiUrl: __DEV__ ? MANUAL_DEV_API_URL.trim() || `http://${apiHost}:4000` : PRODUCTION_API_BASE,
  // Google OAuth Web client ID (required for Google Sign-In idToken on mobile)
  googleWebClientId: "",
} as const;
