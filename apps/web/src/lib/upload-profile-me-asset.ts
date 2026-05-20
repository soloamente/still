import { env } from "@still/env/web";

/**
 * Uploads a profile banner or avatar through the authenticated API (multipart).
 * Shared by `/me/settings` (flush staged media) and `/me/customization`.
 */
export async function uploadProfileMeAsset(
	path: "/api/profiles/me/banner" | "/api/profiles/me/avatar",
	file: File,
): Promise<string> {
	const form = new FormData();
	form.append("file", file);
	const res = await fetch(new URL(path, env.NEXT_PUBLIC_SERVER_URL), {
		method: "POST",
		body: form,
		credentials: "include",
	});
	if (!res.ok) {
		let msg = `Upload failed (${res.status})`;
		try {
			const body = (await res.json()) as {
				error?: string;
				code?: string;
				hint?: string;
			};
			if (body.code === "BLOB_UNCONFIGURED") {
				msg =
					body.hint ??
					"Add BLOB_READ_WRITE_TOKEN to the API server .env (Vercel Blob token).";
			} else if (body.code === "BLOB_ACCESS_MISMATCH" && body.hint) {
				msg = body.hint;
			} else if (body.error) msg = body.error;
		} catch {
			/* use default */
		}
		throw new Error(msg);
	}
	const { url } = (await res.json()) as { url: string };
	return url;
}
