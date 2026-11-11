// Site-wide password for deployments (HTTP Basic auth, checked in proxy.ts).
import { createHash, timingSafeEqual } from "node:crypto";

export type SiteAccess = "open" | "allowed" | "challenge" | "unconfigured";

/**
 * Decide one request. Locally, no password means the site is open. On Vercel a
 * password is required, so a public deployment can never run unprotected by
 * accident (anyone could otherwise use the Groq key and read History).
 */
export function siteAccess(authorization: string | null, password: string | undefined, hosted: boolean): SiteAccess {
  if (!password) return hosted ? "unconfigured" : "open";
  return passwordMatches(authorization, password) ? "allowed" : "challenge";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Any username works; only the password after the first ":" is checked, in constant time. */
export function passwordMatches(authorization: string | null, password: string): boolean {
  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i.exec(authorization ?? "");
  if (!match) return false;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  // Hashing first makes both sides the same length, as timingSafeEqual requires.
  return timingSafeEqual(digest(decoded.slice(separator + 1)), digest(password));
}
