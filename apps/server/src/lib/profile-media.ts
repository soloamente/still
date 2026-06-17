import { type DiaryMetalTier, resolveDiaryMetalTier } from "./diary-metal-tier";

/** Profile preference keys for animated avatar/banner GIF playback. */
export const PROFILE_PREF_AVATAR_IS_ANIMATED = "avatarIsAnimated" as const;
export const PROFILE_PREF_BANNER_IS_ANIMATED = "bannerIsAnimated" as const;
export const PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER =
	"profilePortraitGrayscaleUntilHover" as const;
export const PROFILE_PREF_PRIVACY_PRESENCE_VISIBILITY =
	"presenceVisibility" as const;
export const PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS = "friends" as const;
export const PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC = "public" as const;
export type ProfilePresenceVisibility =
	| typeof PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS
	| typeof PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC;

/** Returned when a patron uploads animated media without Pro entitlement. */
export const PRO_ANIMATED_MEDIA_REQUIRED =
	"PRO_ANIMATED_MEDIA_REQUIRED" as const;

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

export function readAvatarIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_AVATAR_IS_ANIMATED] === true;
}

/** Slim profile shape for feed, search, follows, and other avatar surfaces. */
export function serializePatronProfileForClient(
	profile:
		| {
				handle: string;
				displayName: string;
				preferences?: Record<string, unknown> | null;
		  }
		| null
		| undefined,
	logsCount = 0,
): {
	handle: string;
	displayName: string;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
} | null {
	if (!profile?.handle) return null;
	return {
		handle: profile.handle,
		displayName: profile.displayName,
		avatarIsAnimated: readAvatarIsAnimatedPref(profile.preferences),
		diaryMetalTier: resolveDiaryMetalTier(logsCount),
	};
}

export function readBannerIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_BANNER_IS_ANIMATED] === true;
}

/**
 * Portrait grayscale-on-idle defaults to on; only an explicit `false` opts out.
 */
export function readProfilePortraitGrayscaleUntilHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	const raw = preferences[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER];
	if (raw === false) return false;
	return true;
}

/**
 * Listing presence identity visibility defaults to friends-only unless explicitly public.
 */
export function readProfilePresenceVisibilityPref(
	preferences: Record<string, unknown> | null | undefined,
): ProfilePresenceVisibility {
	const privacy = preferences?.privacy;
	if (!privacy || typeof privacy !== "object") {
		return PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS;
	}
	const raw = (privacy as Record<string, unknown>)[
		PROFILE_PREF_PRIVACY_PRESENCE_VISIBILITY
	];
	if (raw === PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC) {
		return PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC;
	}
	return PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS;
}

export function mergeAvatarAnimationPref(
	existing: Record<string, unknown>,
	isAnimated: boolean,
): Record<string, unknown> {
	return { ...existing, [PROFILE_PREF_AVATAR_IS_ANIMATED]: isAnimated };
}

export function mergeBannerAnimationPref(
	existing: Record<string, unknown>,
	isAnimated: boolean,
): Record<string, unknown> {
	return { ...existing, [PROFILE_PREF_BANNER_IS_ANIMATED]: isAnimated };
}
