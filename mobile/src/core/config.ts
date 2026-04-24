import { NativeModules, Platform } from "react-native";

/**
 * API base URL for the Nest backend.
 * - Android emulator: use 10.0.2.2 (not localhost)
 * - iOS simulator: localhost works
 * - Physical device: set your machine's LAN IP, e.g. http://192.168.1.5:4000
 *
 * Optional: start Metro with API_URL override (see babel inline env or .env tooling).
 */
const MANUAL_DEV_API_HOST = "";

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

const defaultHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const detectedHost = getMetroHost();
const normalizedDetectedHost = detectedHost?.replace(/^\[|\]$/g, "") ?? null;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "10.0.2.2"]);
const apiHost =
  MANUAL_DEV_API_HOST.trim() ||
  (normalizedDetectedHost && !loopbackHosts.has(normalizedDetectedHost) ? normalizedDetectedHost : defaultHost);

export const config = {
  apiUrl: `http://${apiHost}:4000`,
  // Google OAuth Web client ID (required for Google Sign-In idToken on mobile)
  googleWebClientId: "",
} as const;
