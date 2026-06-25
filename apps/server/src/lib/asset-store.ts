import { env } from "@still/env/server";
import { get as vercelGet } from "@vercel/blob";

import { vercelBlobImagePut } from "./vercel-blob-image-put";

/** Minimal R2 surface we use (typed locally so the Bun/Node tsconfig stays clean). */
export interface AssetsBucket {
	put(
		key: string,
		value: ArrayBuffer | ReadableStream | string,
		opts?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
	get(key: string): Promise<{
		body: ReadableStream;
		httpMetadata?: { contentType?: string };
	} | null>;
}

let _bucket: AssetsBucket | null = null;

/** Called once per request from the Workers entry. `null` → Vercel Blob fallback. */
export function setAssetsBucket(bucket: AssetsBucket | null): void {
	_bucket = bucket;
}

/** A stored value is an R2 key when it is not an absolute http(s) URL. */
export function isR2Key(value: string): boolean {
	return !/^https?:\/\//i.test(value);
}

export type PutImageResult =
	| { value: string }
	| { error: string; code: string; hint?: string };

/**
 * Upload an image. On Workers (bucket bound) writes to R2 and returns the object
 * KEY. Otherwise falls back to Vercel Blob and returns the blob URL. The returned
 * `value` is what callers persist in the DB column.
 */
export async function putImageAsset(
	key: string,
	file: File,
): Promise<PutImageResult> {
	if (_bucket) {
		try {
			await _bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type || "application/octet-stream" },
			});
			return { value: key };
		} catch (err) {
			console.error("[asset-store] r2 put failed", err);
			return { error: "Asset upload failed", code: "R2_UPLOAD_FAILED" };
		}
	}
	const fallback = await vercelBlobImagePut(key, file);
	if ("error" in fallback) return fallback;
	return { value: fallback.url };
}

export type ImageBody = { body: ReadableStream; contentType: string };

/**
 * Resolve a stored image value to a streamable body. Handles R2 keys (bound
 * bucket), legacy Vercel Blob URLs, and external http(s) URLs (OAuth headshots).
 * Returns null when the asset cannot be resolved.
 */
export async function getImageAsset(value: string): Promise<ImageBody | null> {
	const trimmed = value.trim();
	if (!trimmed) return null;

	if (_bucket && isR2Key(trimmed)) {
		const obj = await _bucket.get(trimmed);
		if (!obj) return null;
		return {
			body: obj.body,
			contentType: obj.httpMetadata?.contentType ?? "image/jpeg",
		};
	}

	if (trimmed.includes("blob.vercel-storage.com")) {
		if (!env.BLOB_READ_WRITE_TOKEN) return null;
		const result = await vercelGet(trimmed, {
			access: env.BLOB_STORE_ACCESS,
			token: env.BLOB_READ_WRITE_TOKEN,
		});
		if (!result || result.statusCode !== 200 || !result.stream) return null;
		return { body: result.stream, contentType: result.blob.contentType };
	}

	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		const upstream = await fetch(trimmed);
		if (!upstream.ok || !upstream.body) return null;
		return {
			body: upstream.body,
			contentType: upstream.headers.get("content-type") ?? "image/jpeg",
		};
	}

	return null;
}
