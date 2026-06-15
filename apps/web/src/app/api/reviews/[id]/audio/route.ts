import { proxyMultipartUpstream } from "@/lib/proxy-multipart-upstream";

/**
 * Explicit proxy for voice review upload — Next rewrites drop multipart bodies.
 */
export async function POST(
	req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const { id } = await ctx.params;
	return proxyMultipartUpstream(
		req,
		`/api/reviews/${id}/audio`,
		`api/reviews/${id}/audio`,
	);
}
