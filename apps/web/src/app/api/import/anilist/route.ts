import { cookies } from "next/headers";

import { apiUpstreamOrigin } from "@/lib/api-upstream-origin";

/** Anilist imports can run for minutes on large lists — allow long upstream waits. */
export const maxDuration = 300;

/**
 * Explicit proxy for multipart Anilist JSON upload.
 *
 * Next.js dev rewrites often drop or truncate large `multipart/form-data` bodies
 * (`ECONNRESET` / 500 with no Elysia logs). This handler reads FormData once,
 * then forwards cookies + body to the Elysia server.
 */
export async function POST(req: Request) {
	try {
		const store = await cookies();
		const cookieHeader = store
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join("; ");

		const formData = await req.formData();
		const upstreamUrl = new URL("/api/import/anilist", apiUpstreamOrigin());

		const upstream = await fetch(upstreamUrl, {
			method: "POST",
			body: formData,
			headers: cookieHeader ? { cookie: cookieHeader } : {},
			cache: "no-store",
		});

		const body = await upstream.text();
		return new Response(body, {
			status: upstream.status,
			headers: {
				"content-type":
					upstream.headers.get("content-type") ?? "application/json",
			},
		});
	} catch (err) {
		console.error("[api/import/anilist] upstream proxy failed", err);
		return Response.json(
			{ error: "Import failed — try again in a moment" },
			{ status: 500 },
		);
	}
}
