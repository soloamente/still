/**
 * Stable keys under profile `preferences` (opaque JSON; Settings PATCH shallow-merges).
 * Use these constants in the web app so reads/writes stay aligned.
 */
export const PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER =
	"catalogMonochromePeersOnHover" as const;

/**
 * Home lobby: when `true`, non-hovered poster tiles use sibling `grayscale` (CSS `:has()`).
 * Default `true` so existing users keep current behavior until they turn it off in Settings.
 * Persisted `false` disables the effect.
 */
export function readCatalogMonochromePeersOnHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	const raw = preferences[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER];
	if (raw === false) return false;
	return true;
}
