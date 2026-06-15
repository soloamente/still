import { env } from "@still/env/server";
import { put } from "@vercel/blob";

import { assertReviewAudioUpload } from "./review-audio";

/** Upload one voice review clip to Vercel Blob after MIME/size/duration checks. */
export async function vercelBlobAudioPut(
	key: string,
	file: File,
	durationMs: number,
): Promise<
	| { url: string; mimeType: string }
	| { error: string; code: string; hint?: string }
> {
	const check = assertReviewAudioUpload({
		size: file.size,
		type: file.type,
		durationMs,
	});
	if (!check.ok) {
		return { error: check.message, code: check.code };
	}

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
			contentType: check.mimeType,
		});
		return { url: blob.url, mimeType: check.mimeType };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[vercel-blob-audio-put] put failed", err);
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
