/** Activity tab scope on `/home?browse=community&sort=activity`. */
export type HomeCommunityActivityScope = "following" | "discover";

export const DEFAULT_HOME_COMMUNITY_ACTIVITY_SCOPE: HomeCommunityActivityScope =
	"following";

export function parseHomeCommunityActivityScope(
	raw: string | undefined | null,
): HomeCommunityActivityScope {
	const scope = raw?.trim().toLowerCase() ?? "";
	if (scope === "discover" || scope === "public") {
		return "discover";
	}
	return DEFAULT_HOME_COMMUNITY_ACTIVITY_SCOPE;
}

export function serializeHomeCommunityActivityScope(
	scope: HomeCommunityActivityScope,
): string | undefined {
	return scope === "discover" ? "discover" : undefined;
}
