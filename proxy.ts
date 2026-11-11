import { NextResponse, type NextRequest } from "next/server";
import { isHosted } from "./lib/config";
import { siteAccess } from "./lib/site-auth";

/**
 * Password-protects every page and API route when SITE_PASSWORD is set (required on
 * Vercel). Browsers show their own sign-in box; any username works with the password.
 */
export function proxy(request: NextRequest) {
  const access = siteAccess(request.headers.get("authorization"), process.env.SITE_PASSWORD?.trim() || undefined, isHosted());
  if (access === "open" || access === "allowed") return NextResponse.next();
  if (access === "unconfigured") {
    return new NextResponse(
      "This deployment has no SITE_PASSWORD. Set it in the Vercel project's environment variables, then redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return new NextResponse("Source Sync is password protected.", {
    status: 401,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="Source Sync", charset="UTF-8"',
    },
  });
}

export const config = {
  // Everything except build assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
