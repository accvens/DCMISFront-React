function normalizeApiBase(value) {
  return String(value || "").replace(/\/+$/, "");
}

/** Same rules as the app shell: env, dev proxy path, or same-host production API. */
export function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv) {
    return normalizeApiBase(fromEnv);
  }
  if (import.meta.env.DEV) {
    return "/api/v1";
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return "/api/v1";
}

export function getApiOrigin(value) {
  const s = String(value || "");
  if (!s || s.startsWith("/")) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  try {
    return new URL(s).origin;
  } catch {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
}

/**
 * Absolute or same-origin-relative URL for files stored under the API host (uploads, etc.).
 * In dev with a relative API base, returns a path so Vite can proxy it.
 */
export function resolveUploadedAssetHref(filePath) {
  if (!filePath) {
    return "";
  }
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  const apiBase = resolveApiBase();
  if (import.meta.env.DEV && String(apiBase).startsWith("/")) {
    return path;
  }
  const origin = getApiOrigin(apiBase);
  return origin ? `${origin}${path}` : path;
}
