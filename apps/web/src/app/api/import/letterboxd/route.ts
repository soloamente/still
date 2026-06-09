import { proxyMultipartUpstream } from "@/lib/proxy-multipart-upstream";

/** Large Letterboxd diaries can take a while to match and insert. */
export const maxDuration = 300;

/**
 * Explicit proxy for multipart Letterboxd CSV upload.
 *
 * Next.js rewrites often drop or truncate large `multipart/form-data` bodies.
 * Browser clients must POST here (same origin as session cookies), not the
 * standalone Elysia deployment.
 */
export async function POST(req: Request) {
	return proxyMultipartUpstream(
		req,
		"/api/import/letterboxd",
		"api/import/letterboxd",
	);
}
