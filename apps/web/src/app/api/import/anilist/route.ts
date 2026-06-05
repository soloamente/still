import { proxyMultipartUpstream } from "@/lib/proxy-multipart-upstream";

/** Anilist imports can run for minutes on large lists — allow long upstream waits. */
export const maxDuration = 300;

/**
 * Explicit proxy for multipart Anilist JSON upload.
 *
 * Next.js rewrites often drop or truncate large `multipart/form-data` bodies
 * (`ECONNRESET` / 500 with no Elysia logs). This handler reads FormData once,
 * then forwards cookies + body to the Elysia server.
 */
export async function POST(req: Request) {
	return proxyMultipartUpstream(
		req,
		"/api/import/anilist",
		"api/import/anilist",
	);
}
