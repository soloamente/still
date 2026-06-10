import { readAvatarIsAnimatedPref } from "@/lib/profile-preferences";

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
