import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Blank env values become undefined so optional Upstash keys do not crash boot. */
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

export const env = createEnv({
	server: {
		// Upstash Redis REST — used by GET /api/realtime/stream (SSE) on Next.
		UPSTASH_REDIS_REST_URL: optionalUrl(),
		UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString(),
	},
	client: {
		NEXT_PUBLIC_SERVER_URL: z.url(),
		NEXT_PUBLIC_REALTIME_WS_URL: optionalUrl(),
		NEXT_PUBLIC_REALTIME_TRANSPORT: z.enum(["sse", "ws"]).optional(),
	},
	runtimeEnv: {
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_REALTIME_WS_URL: process.env.NEXT_PUBLIC_REALTIME_WS_URL,
		NEXT_PUBLIC_REALTIME_TRANSPORT: process.env.NEXT_PUBLIC_REALTIME_TRANSPORT,
	},
	emptyStringAsUndefined: true,
});
