import { proxyMultipartUpstream } from "@/lib/proxy-multipart-upstream";

/**
 * Explicit proxy for profile banner upload — rewrites drop multipart bodies.
 */
export async function POST(req: Request) {
	return proxyMultipartUpstream(
		req,
		"/api/profiles/me/banner",
		"api/profiles/me/banner",
	);
}
