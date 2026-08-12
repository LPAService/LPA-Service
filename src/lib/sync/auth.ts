import type { NextRequest } from "next/server";

export function hasCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get("secret") === secret
  );
}
