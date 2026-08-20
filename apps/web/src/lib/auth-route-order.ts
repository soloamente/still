/**
 * Ordered auth convert-card routes — index drives transitions.dev page-slide
 * direction inside the shared `AuthPageShell` (sign-in ↔ sign-up ↔ reset).
 */
export const AUTH_ROUTE_ORDER = [
	"/sign-in",
	"/sign-up",
	"/forgot-password",
	"/reset-password",
] as const;

export type AuthRoutePath = (typeof AUTH_ROUTE_ORDER)[number];

/** Resolve an unknown path to the nearest ordered auth route (default sign-in). */
export function resolveAuthRoutePath(pathname: string): AuthRoutePath {
	if ((AUTH_ROUTE_ORDER as readonly string[]).includes(pathname)) {
		return pathname as AuthRoutePath;
	}
	return "/sign-in";
}

export function authRouteIndex(pathname: string): number {
	const resolved = resolveAuthRoutePath(pathname);
	return AUTH_ROUTE_ORDER.indexOf(resolved);
}

/**
 * Slide direction when the shared shell swaps convert-card body.
 * Higher index = forward (enter from right); lower = back.
 */
export function authRouteSlideDirection(
	fromPath: string,
	toPath: string,
): "forward" | "back" {
	return authRouteIndex(toPath) >= authRouteIndex(fromPath)
		? "forward"
		: "back";
}
