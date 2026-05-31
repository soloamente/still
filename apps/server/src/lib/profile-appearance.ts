/** Server mirror of web `profile-appearance` — ids only, no UI imports. */

export const PROFILE_PREF_PROFILE_ACCENT = "profileAccent" as const;
export const PROFILE_PREF_BANNER_FRAME = "bannerFrame" as const;

export const PROFILE_ACCENT_IDS = [
	"desert",
	"copper",
	"rose",
	"slate",
] as const;
export type ProfileAccentId = (typeof PROFILE_ACCENT_IDS)[number];

export const PROFILE_BANNER_FRAME_IDS = [
	"none",
	"cinema",
	"editorial",
] as const;
export type ProfileBannerFrameId = (typeof PROFILE_BANNER_FRAME_IDS)[number];

const PROFILE_ACCENT_HEX: Record<ProfileAccentId, string> = {
	desert: "#c45c26",
	copper: "#b75928",
	rose: "#c45c2a",
	slate: "#8b9aab",
};

export function isProfileAccentId(value: unknown): value is ProfileAccentId {
	return (
		typeof value === "string" &&
		(PROFILE_ACCENT_IDS as readonly string[]).includes(value)
	);
}

export function isProfileBannerFrameId(
	value: unknown,
): value is ProfileBannerFrameId {
	return (
		typeof value === "string" &&
		(PROFILE_BANNER_FRAME_IDS as readonly string[]).includes(value)
	);
}

export function profileAccentHex(id: ProfileAccentId): string {
	return PROFILE_ACCENT_HEX[id];
}
