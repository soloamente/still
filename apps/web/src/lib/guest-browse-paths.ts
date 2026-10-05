const ACCOUNT_PREFIXES = [
	"/diary",
	"/lists",
	"/watchlist",
	"/quotes",
	"/me",
	"/achievements",
	"/notifications",
	"/chat",
] as const;

export function isAccountRequiredPath(pathname: string): boolean {
	return ACCOUNT_PREFIXES.some((prefix) => {
		// `/me` must not match `/members` — require an exact path or `/me/` boundary.
		if (prefix === "/me") {
			return pathname === "/me" || pathname.startsWith("/me/");
		}
		return pathname === prefix || pathname.startsWith(`${prefix}/`);
	});
}

export function guestAccountRedirect(
	pathname: string,
	hasSession: boolean,
): "/home?account=1" | null {
	if (hasSession || !isAccountRequiredPath(pathname)) return null;
	return "/home?account=1";
}
