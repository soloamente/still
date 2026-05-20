import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
		POLAR_SUCCESS_URL: z.url().optional(),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// TMDb v3 API key (or read-only v4 JWT; both work via lib/tmdb.ts).
		// Without this, movie search and rails are empty — create a key at
		// https://www.themoviedb.org/settings/api
		TMDB_API_KEY: z.string().min(10).optional(),
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
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
