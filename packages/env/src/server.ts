import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Polar is opt-in — blank or invalid dashboard placeholders must not crash boot. */
function optionalNonEmptyString() {
	return z.preprocess((val) => {
		if (typeof val !== "string") return undefined;
		const trimmed = val.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}, z.string().min(1).optional());
}

function optionalUrl() {
	return z.preprocess((val) => {
		if (typeof val !== "string") return undefined;
		const trimmed = val.trim();
		if (!trimmed) return undefined;
		return z.url().safeParse(trimmed).success ? trimmed : undefined;
	}, z.url().optional());
}

/** Server-only env schema — extracted so `createEnv<undefined, …>` keeps `clientPrefix` unset under TS 6 / Vercel checks. */
const serverEnv = {
	DATABASE_URL: z.string().min(1),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	POLAR_ACCESS_TOKEN: optionalNonEmptyString(),
	POLAR_SUCCESS_URL: optionalUrl(),
	POLAR_WEBHOOK_SECRET: optionalNonEmptyString(),
	POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
	POLAR_PRODUCT_ATTUNED_MONTHLY: optionalNonEmptyString(),
	POLAR_PRODUCT_ATTUNED_YEARLY: optionalNonEmptyString(),
	POLAR_PRODUCT_IMMERSED_MONTHLY: optionalNonEmptyString(),
	POLAR_PRODUCT_IMMERSED_YEARLY: optionalNonEmptyString(),
	POLAR_PRODUCT_DEVOTED_MONTHLY: optionalNonEmptyString(),
	POLAR_PRODUCT_DEVOTED_YEARLY: optionalNonEmptyString(),
	POLAR_DISCOUNT_REFERRAL10: optionalNonEmptyString(),
	CORS_ORIGIN: z.url(),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	// TMDb v3 API key (or read-only v4 JWT; both work via lib/tmdb.ts).
	// Without this, movie search and rails are empty — create a key at
	// https://www.themoviedb.org/settings/api
	TMDB_API_KEY: z.string().min(10).optional(),
	/**
	 * External quote catalog provider slug.
	 * - `moviefamous` — free keyless bulk catalog (recommended for dev)
	 * - `moviequotes` — MovieQuotes.rocks (paid; free tier is only 20 quotes)
	 */
	QUOTE_API_PROVIDER: z.enum(["moviefamous", "moviequotes", "stub"]).optional(),
	/** API key from https://moviequotes.rocks (Google form in their docs). */
	MOVIQUOTES_API_KEY: optionalNonEmptyString(),
	/** When `true`, seed empty film Quotes tabs from the configured provider. */
	QUOTE_IMPORT_ENABLED: z
		.enum(["true", "false", "1", "0", "yes", "no"])
		.optional(),
	/**
	 * ISO 3166-1 alpha-2 (e.g. `US`, `IT`) — used for (1) TMDb discover
	 * `watch_region` with monetization filters and (2) default `region` for
	 * “newest in cinemas” theatrical discover (`primary_release_date.lte`).
	 * Defaults to `US` in code when unset.
	 */
	TMDB_WATCH_REGION: z.string().length(2).optional(),
	// Vercel Blob token for avatar/banner uploads. Optional in dev — uploads
	// simply degrade to local stub URLs when unset.
	BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
	// Must match the store setting in the Vercel dashboard. New Blob stores are
	// often "private"; using `public` uploads against a private store fails at
	// `put()` time. Set to `private` for private stores (banners are served
	// through GET /api/profiles/banner/:handle which streams via `get()`).
	BLOB_STORE_ACCESS: z.enum(["public", "private"]).default("public"),
	// Resend API key for transactional email (account-deletion verification).
	// Optional — when unset (local dev), emails fall back to console logging.
	RESEND_API_KEY: optionalNonEmptyString(),
	// Verified Resend sender, e.g. "Sense <noreply@updates.example.com>".
	EMAIL_FROM: optionalNonEmptyString(),
	// Upstash Redis REST — optional in dev; realtime publish/SSE no-op when unset.
	UPSTASH_REDIS_REST_URL: optionalUrl(),
	UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString(),
	// Cloudflare Realtime Worker — optional; when unset, Upstash SSE is used.
	REALTIME_WORKER_URL: optionalUrl(),
	REALTIME_JWT_SECRET: optionalNonEmptyString(),
	REALTIME_INTERNAL_SECRET: optionalNonEmptyString(),
	// Public base URL of the R2 media bucket (review audio), e.g.
	// https://media.sense.fans. When unset, audio falls back to Vercel Blob.
	MEDIA_PUBLIC_BASE: optionalUrl(),
	/** Cloudflare account id — optional; speeds up local R2 image reads via S3 API. */
	R2_ACCOUNT_ID: optionalNonEmptyString(),
	/** R2 S3 API credentials — optional; preferred local dev path for profile media. */
	R2_ACCESS_KEY_ID: optionalNonEmptyString(),
	R2_SECRET_ACCESS_KEY: optionalNonEmptyString(),
	/** Private images bucket (default `cue-assets`). */
	R2_ASSETS_BUCKET: optionalNonEmptyString(),
};

export const env = createEnv<undefined, typeof serverEnv>({
	server: serverEnv,
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
