import "server-only";

import { cookies } from "next/headers";

import { apiUpstreamOrigin } from "@/lib/api-upstream-origin";

/**
 * Forwards multipart POST bodies to the Elysia API with session cookies.
 *
 * Next.js `/api/*` rewrites often drop or truncate `multipart/form-data` bodies
 * in production, so profile media uploads use explicit route handlers instead.
 */
export async function proxyMultipartUpstream(
	req: Request,
	upstreamPath: string,
	logLabel: string,
): Promise<Response> {
	try {
		const store = await cookies();
		const cookieHeader = store
			.getAll()
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join("; ");

		const formData = await req.formData();
		const upstreamUrl = new URL(upstreamPath, apiUpstreamOrigin());

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
		console.error(`[${logLabel}] upstream proxy failed`, err);
		return Response.json(
			{ error: "Upload failed — try again in a moment" },
			{ status: 500 },
		);
	}
}
