export function getAppOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredOrigin) return requestOrigin;

  try {
    const url = new URL(configuredOrigin);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname.endsWith(".localhost");
    if (process.env.NODE_ENV === "production" && isLocalhost) return requestOrigin;
    return url.origin;
  } catch {
    return requestOrigin;
  }
}