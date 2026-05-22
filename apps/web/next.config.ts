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

/**
 * Upstream Elysia host for `/api/*` rewrites. In production the browser must
 * call the **web** origin (`NEXT_PUBLIC_SERVER_URL`); this value is only the
 * rewrite target (e.g. `cue-server-*.vercel.app` or `http://localhost:3000`).
 */
const apiRewriteOrigin =
	process.env.API_REWRITE_ORIGIN?.trim() || env.NEXT_PUBLIC_SERVER_URL;

const nextConfig: NextConfig = {
	// Typed routes are useful but get loud while we wire up dozens of pages in
	// parallel; keep disabled for v1 and turn back on after the route map
	// stabilizes.
	typedRoutes: false,
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${apiRewriteOrigin}/api/:path*`,
			},
		];
	},
	reactCompiler: true,
	/** View Transitions for `<Link transitionTypes>` when React exposes the API — CSS above is ready. */
	experimental: {
		viewTransition: true,
	},
	images: {
		remotePatterns: [
			profileAssetPattern,
			listCoverAssetPattern,
			// TMDb poster / backdrop / logo CDN
			{ protocol: "https", hostname: "image.tmdb.org" },
			// Vercel Blob (avatars / banners)
			{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
			// Common headshot / studio logo CDNs that show up in RSS thumbnails.
			{ protocol: "https", hostname: "**" },
		],
	},
};

export default nextConfig;
