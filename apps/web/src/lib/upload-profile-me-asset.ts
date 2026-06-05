/**
 * Uploads a profile banner or avatar through the authenticated API (multipart).
 * Shared by `/me/settings` (flush staged media) and `/me/customization`.
 *
 * Uses same-origin relative paths so session cookies stay on the web host.
 * Dedicated Next route handlers forward FormData to Elysia (rewrites drop
 * multipart bodies in production).
 */
export async function uploadProfileMeAsset(
	path: "/api/profiles/me/banner" | "/api/profiles/me/avatar",
	file: File,
): Promise<string> {
	const form = new FormData();
	form.append("file", file);
	const res = await fetch(path, {
		method: "POST",
		body: form,
		credentials: "include",
		cache: "no-store",
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
	const data = (await res.json()) as { url?: string; error?: string };
	const url = data.url?.trim();
	if (!url) {
		throw new Error(data.error ?? "Upload succeeded but no URL returned");
	}
	return url;
}
