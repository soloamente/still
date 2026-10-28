import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";

/**
 * Home lobby header on film and TV detail. `fetchMeProfile` is already cached
 * for the page render, so this does not add a second profile request. Guests
 * get the signed-out chrome (`user` null).
 */
async function DetailHomeStickyChrome() {
	const [session, profileResult] = await Promise.all([
		authServer(),
		fetchMeProfile(),
	]);
	const profile = profileResult === PROFILE_FETCH_FAILED ? null : profileResult;

	return <HomeStickyChrome user={buildPatronNavUserOrNull(session, profile)} />;
}

/** Streams the home header above the detail card without blocking the title. */
export function DetailHomeStickyChromeSlot() {
	return (
		<Suspense fallback={<LobbyStickyChromeFallback />}>
			<DetailHomeStickyChrome />
		</Suspense>
	);
}
