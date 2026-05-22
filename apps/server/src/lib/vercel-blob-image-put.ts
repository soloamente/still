import { env } from "@still/env/server";
import { put } from "@vercel/blob";

/** Upload one image to Vercel Blob; maps store access mismatches to API-friendly errors. */
export async function vercelBlobImagePut(
	key: string,
	file: File,
): Promise<{ url: string } | { error: string; code: string; hint?: string }> {
	if (!env.BLOB_READ_WRITE_TOKEN) {
		return {
			error: "BLOB_READ_WRITE_TOKEN is not set",
			code: "BLOB_UNCONFIGURED",
			hint: "Add BLOB_READ_WRITE_TOKEN to apps/server .env (Vercel Blob read-write token).",
		};
	}
	try {
		const blob = await put(key, file, {
			access: env.BLOB_STORE_ACCESS,
			addRandomSuffix: false,
			token: env.BLOB_READ_WRITE_TOKEN,
		});
		return { url: blob.url };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[vercel-blob-image-put] put failed", err);
		if (msg.includes("private store")) {
			return {
				error:
					"Blob store is private but upload used public access (or the reverse).",
				code: "BLOB_ACCESS_MISMATCH",
				hint: "Set BLOB_STORE_ACCESS=private in apps/server .env to match a private Vercel Blob store (default in env is public).",
			};
		}
		if (msg.includes("public store") || msg.includes("public access")) {
			return {
				error: msg,
				code: "BLOB_ACCESS_MISMATCH",
				hint: "Set BLOB_STORE_ACCESS=public in apps/server .env if your Blob store is public, or use a private store with BLOB_STORE_ACCESS=private.",
			};
		}
		return { error: "Blob upload failed", code: "BLOB_UPLOAD_FAILED" };
	}
}
