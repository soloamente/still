import { env } from "@still/env/web";

/**
 * Absolute URL for the profile banner image. Always goes through the API
 * (`GET /api/profiles/banner/:handle`) so **private** Vercel Blob objects
 * (which are not directly fetchable in the browser) still render.
 */
export function profileBannerImageUrl(handle: string): string {
  return new URL(`/api/profiles/banner/${encodeURIComponent(handle)}`, env.NEXT_PUBLIC_SERVER_URL)
    .href;
}
