import { readAvatarIsAnimatedPref } from "@/lib/profile-preferences";

/** Shown when a non-Pro patron picks an animated portrait. */
export const PRO_ANIMATED_PORTRAIT_MESSAGE =
	"Animated portrait requires Sense Pro.";

/**
 * True when the upload should be treated as an animated GIF.
 * MIME is authoritative; fall back to `.gif` extension for generic image/* types.
 */
export function isAnimatedGifUpload(file: File): boolean {
	const type = file.type?.toLowerCase() ?? "";
	if (type === "image/gif") return true;
	const name = file.name?.toLowerCase() ?? "";
	return name.endsWith(".gif");
}

/** Client-side Pro gate — mirrors `POST /api/profiles/me/avatar`. */
export function assertProfilePortraitUploadAllowed(
	file: File,
	isPro: boolean,
): void {
	if (isAnimatedGifUpload(file) && !isPro) {
		throw new Error(PRO_ANIMATED_PORTRAIT_MESSAGE);
	}
}

/**
 * Resolves whether profile avatar/banner should play as animated GIF.
 * Explicit preference flag wins; otherwise infer from stored `.gif` URL.
 */
export function inferAnimatedFromProfileUrl(
	storedUrl: string | null | undefined,
	flag: boolean | undefined,
): boolean {
	if (flag === true) return true;
	if (flag === false) return false;
	if (!storedUrl?.trim()) return false;
	return /\.gif(\?|$)/i.test(storedUrl);
}

/** Signed-in nav surfaces — prefs from `GET /api/profiles/me` plus session image. */
export function resolvePatronAvatarIsAnimated(
	image: string | null | undefined,
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return inferAnimatedFromProfileUrl(
		image,
		readAvatarIsAnimatedPref(preferences),
	);
}
