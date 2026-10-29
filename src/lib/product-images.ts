/** Host of merchandise photos. Set per deploy; stored rows keep the path only. */
export function productImageOrigin() {
  return (process.env.PRODUCT_IMAGE_ORIGIN ?? "").trim().replace(/\/+$/, "");
}

export function productImageUrl(path: string | null | undefined) {
  const origin = productImageOrigin();
  const p = (path ?? "").trim();
  if (!origin || !p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${origin}${p.startsWith("/") ? p : `/${p}`}`;
}

export function cleanImagePath(path: string | null | undefined) {
  const p = (path ?? "").trim();
  if (!p.startsWith("/")) return null;
  if (p.includes("..") || p.includes("\\") || p.includes("?") || p.includes("#")) return null;
  if (p.length > 500) return null;
  return p;
}

function siteHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

export function pathFromImageUrl(raw: string, origin: string) {
  try {
    const url = new URL(raw);
    const base = new URL(origin);
    if (siteHost(url.host) !== siteHost(base.host)) return null;
    return cleanImagePath(url.pathname);
  } catch {
    return null;
  }
}
