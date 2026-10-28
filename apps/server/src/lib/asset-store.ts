import { env } from "@still/env/server";
import { get as vercelGet } from "@vercel/blob";
import { fetchR2AssetDevFallback, r2KeyCandidates } from "./r2-dev-assets";
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

/** Object-key prefixes written by `putImageAsset` upload routes. */
export const SENSE_IMAGE_KEY_PREFIXES = [
	"banners/",
	"avatars/",
	"list-covers/",
] as const;

/**
 * True when `value` is an R2 object key Sense uploads own (prefix + no traversal).
 * Rejects arbitrary bare keys that would otherwise read the shared assets bucket.
 */
export function isSenseR2ImageKey(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed || !isR2Key(trimmed)) return false;
	if (
		trimmed.includes("..") ||
		trimmed.startsWith("/") ||
		trimmed.includes("\\")
	) {
		return false;
	}
	return SENSE_IMAGE_KEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/** True for https URLs on Vercel Blob hosts (legacy public/private blob columns). */
export function isVercelBlobImageUrl(value: string): boolean {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "https:") return false;
		const host = url.hostname.toLowerCase();
		return (
			host === "blob.vercel-storage.com" ||
			host.endsWith(".blob.vercel-storage.com")
		);
	} catch {
		return false;
	}
}

/**
 * Values safe to persist on `bannerUrl` / `coverImageUrl` / uploaded `user.image`
 * (upload-returned keys or blob URLs — not arbitrary attacker URLs).
 */
export function isSensePersistedImageRef(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	return isSenseR2ImageKey(trimmed) || isVercelBlobImageUrl(trimmed);
}

/** OAuth portrait CDNs we may still server-fetch for `/avatar/:handle`. */
const OAUTH_AVATAR_HOST_SUFFIXES = [
	"googleusercontent.com",
	"ggpht.com",
	"discordapp.com",
	"discordapp.net",
] as const;

/**
 * True when outbound `fetch` is allowed for a non-blob absolute URL (OAuth
 * headshots only). Never allow plain `http:` — blocks common SSRF gadgets.
 */
export function isAllowedExternalAvatarFetchUrl(value: string): boolean {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "https:") return false;
		const host = url.hostname.toLowerCase();
		return OAUTH_AVATAR_HOST_SUFFIXES.some(
			(suffix) => host === suffix || host.endsWith(`.${suffix}`),
		);
	} catch {
		return false;
	}
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
 * Resolve a stored image value to a streamable body. Handles Sense R2 keys
 * (bound bucket), legacy Vercel Blob URLs, and allowlisted OAuth headshot
 * https hosts. Never fetches arbitrary URLs (stored SSRF) or reads bare
 * non-Sense R2 keys (cross-tenant object probe).
 */
export async function getImageAsset(value: string): Promise<ImageBody | null> {
	const trimmed = value.trim();
	if (!trimmed) return null;

	// Shared-bucket keys must be Sense upload prefixes (not attacker-chosen paths).
	if (isR2Key(trimmed)) {
		if (!isSenseR2ImageKey(trimmed)) return null;
		if (_bucket) {
			for (const candidate of r2KeyCandidates(trimmed)) {
				const obj = await _bucket.get(candidate);
				if (!obj) continue;
				return {
					body: obj.body,
					contentType: obj.httpMetadata?.contentType ?? "image/jpeg",
				};
			}
			return null;
		}
		// Local `bun dev` — DB stores R2 keys but the Worker ASSETS binding is absent.
		const devAsset = await fetchR2AssetDevFallback(trimmed);
		if (devAsset) return devAsset;
		return null;
	}

	if (isVercelBlobImageUrl(trimmed)) {
		if (!env.BLOB_READ_WRITE_TOKEN) return null;
		const result = await vercelGet(trimmed, {
			access: env.BLOB_STORE_ACCESS,
			token: env.BLOB_READ_WRITE_TOKEN,
		});
		if (!result || result.statusCode !== 200 || !result.stream) return null;
		return { body: result.stream, contentType: result.blob.contentType };
	}

	// OAuth portraits only — never open SSRF to link-local / attacker hosts.
	if (isAllowedExternalAvatarFetchUrl(trimmed)) {
		const upstream = await fetch(trimmed);
		if (!upstream.ok || !upstream.body) return null;
		return {
			body: upstream.body,
			contentType: upstream.headers.get("content-type") ?? "image/jpeg",
		};
	}

	return null;
}

/** Migration helper: write raw bytes to the bound R2 bucket. False when no bucket. */
export async function putRawToR2(
	key: string,
	bytes: ArrayBuffer,
	contentType: string,
): Promise<boolean> {
	if (!_bucket) return false;
	await _bucket.put(key, bytes, { httpMetadata: { contentType } });
	return true;
}
