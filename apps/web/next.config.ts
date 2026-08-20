import { env } from "@still/env/web";
import type { NextConfig } from "next";

/** API image proxies (profiles, list covers) — Next `<Image>` cannot read private Blob URLs. */
const serverOrigin = new URL(env.NEXT_PUBLIC_SERVER_URL);
const serverAssetPattern = {
	protocol: serverOrigin.protocol.replace(":", "") as "http" | "https",
	hostname: serverOrigin.hostname,
	...(serverOrigin.port ? { port: serverOrigin.port } : {}),
} as const;
const profileAssetPattern = {
	...serverAssetPattern,
	pathname: "/api/profiles/**",
} as const;
const listCoverAssetPattern = {
	...serverAssetPattern,
	pathname: "/api/lists/**",
} as const;

const nextConfig: NextConfig = {
	// Typed routes are useful but get loud while we wire up dozens of pages in
	// parallel; keep disabled for v1 and turn back on after the route map
	// stabilizes.
	typedRoutes: false,
	// `/api/*` proxying lives in `src/proxy.ts` so explicit `app/api/.../route.ts`
	// handlers (taste hero media, multipart uploads, SSE) are not rewritten to Elysia.
	reactCompiler: true,
	/** View Transitions for `<Link transitionTypes>` when React exposes the API — CSS above is ready. */
	experimental: {
		viewTransition: true,
	},
	images: {
		// TMDb posters rarely change — long TTL cuts MISS/STALE transforms + cache-write units.
		minimumCacheTTL: 2_678_400, // 31 days
		// Fewer width/quality/format variants → fewer unique optimization cache keys.
		imageSizes: [64, 96, 128, 256, 384],
		deviceSizes: [640, 828, 1080, 1280],
		qualities: [75],
		formats: ["image/webp"],
		remotePatterns: [
			profileAssetPattern,
			listCoverAssetPattern,
			// TMDb poster / backdrop / logo CDN (most call sites bypass optimizer via unoptimized)
			{ protocol: "https", hostname: "image.tmdb.org" },
			// Vercel Blob (avatars / banners)
			{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
			// Discord CDN for activity album art / game icons when not marked unoptimized.
			{ protocol: "https", hostname: "cdn.discordapp.com" },
			{ protocol: "https", hostname: "media.discordapp.net" },
		],
	},
};

export default nextConfig;
