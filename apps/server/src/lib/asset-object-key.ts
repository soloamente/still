/** Allowed image extensions on R2 object keys (lowercase, with dot). */
const SAFE_IMAGE_EXT = /^\.(jpe?g|png|gif|webp|avif)$/;

/**
 * Build a shell- and URL-safe filename segment for R2 keys.
 * Avoids spaces/parentheses that break `wrangler r2 object get` on Windows.
 */
export function r2ObjectKeyFilename(originalName: string): string {
	const trimmed = originalName.trim() || "upload";
	const dot = trimmed.lastIndexOf(".");
	const rawExt = dot >= 0 ? trimmed.slice(dot).toLowerCase() : "";
	const ext = SAFE_IMAGE_EXT.test(rawExt) ? rawExt : ".jpg";
	const rawBase = dot >= 0 ? trimmed.slice(0, dot) : trimmed;
	const base = rawBase
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
	return `${base || "upload"}${ext}`;
}
