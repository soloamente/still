import { env } from "@still/env/server";

import { assertReviewAudioUpload } from "./review-audio";
import { vercelBlobAudioPut } from "./vercel-blob-audio-put";

/** Minimal public-R2 surface (write-only; reads happen at the custom domain). */
export interface MediaBucket {
	put(
		key: string,
		value: ArrayBuffer | ReadableStream | string,
		opts?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
}

let _bucket: MediaBucket | null = null;

/** Called once per request from the Workers entry. `null` → Vercel Blob fallback. */
export function setMediaBucket(bucket: MediaBucket | null): void {
	_bucket = bucket;
}

/** Join the public base and an object key into a browser-playable URL. */
export function mediaPublicUrl(base: string, key: string): string {
	return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

export type PutAudioResult =
	| { url: string; mimeType: string }
	| { error: string; code: string; hint?: string };

/**
 * Upload a validated voice clip. On Workers (bucket bound) writes to the public
 * media bucket and returns its public URL. Otherwise falls back to Vercel Blob.
 */
export async function putAudioAsset(
	key: string,
	file: File,
	durationMs: number,
): Promise<PutAudioResult> {
	const check = assertReviewAudioUpload({
		size: file.size,
		type: file.type,
		durationMs,
	});
	if (!check.ok) return { error: check.message, code: check.code };

	if (_bucket) {
		const base = env.MEDIA_PUBLIC_BASE;
		if (!base) {
			return {
				error: "MEDIA_PUBLIC_BASE is not set",
				code: "MEDIA_UNCONFIGURED",
				hint: "Set MEDIA_PUBLIC_BASE (e.g. https://media.sense.fans) on the Worker.",
			};
		}
		try {
			await _bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: check.mimeType },
			});
			return { url: mediaPublicUrl(base, key), mimeType: check.mimeType };
		} catch (err) {
			console.error("[audio-store] r2 put failed", err);
			return { error: "Audio upload failed", code: "R2_UPLOAD_FAILED" };
		}
	}

	return vercelBlobAudioPut(key, file, durationMs);
}

/** Migration helper: write raw bytes to the bound media bucket. False when no bucket. */
export async function putRawToMedia(
	key: string,
	bytes: ArrayBuffer,
	contentType: string,
): Promise<boolean> {
	if (!_bucket) return false;
	await _bucket.put(key, bytes, { httpMetadata: { contentType } });
	return true;
}
