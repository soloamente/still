import { proxyMultipartUpstream } from "@/lib/proxy-multipart-upstream";

/**
 * Explicit proxy for profile portrait upload — rewrites drop multipart bodies.
 */
export async function POST(req: Request) {
	return proxyMultipartUpstream(
		req,
		"/api/profiles/me/avatar",
		"api/profiles/me/avatar",
	);
}
