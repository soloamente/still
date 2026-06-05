/**
 * Derive a stable cache-bust token from a stored Vercel Blob URL.
 * Upload keys embed `Date.now()` — reuse it so avatar/banner proxies serve fresh bytes.
 */
export function profileMediaCacheKey(
	storedUrl: string | null | undefined,
): string | undefined {
	if (!storedUrl?.trim()) return undefined;
	const timestampMatch = storedUrl.match(/\/(\d{13})-/);
	if (timestampMatch?.[1]) return timestampMatch[1];
	const tail = storedUrl.split("/").pop();
	return tail?.slice(0, 40) || undefined;
}

/** Vercel serverless route handlers reject bodies above ~4.5MB — stay under that in the browser. */
export const MAX_PROFILE_MEDIA_UPLOAD_BYTES = 4_000_000;

export function assertProfileMediaUploadSize(file: File): void {
	if (file.size > MAX_PROFILE_MEDIA_UPLOAD_BYTES) {
		throw new Error("Image must be 4MB or smaller");
	}
}
