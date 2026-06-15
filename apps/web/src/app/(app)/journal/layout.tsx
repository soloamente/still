import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import type { HomeStickyChromeUser } from "@/components/home/home-sticky-chrome";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";

export const dynamic = "force-dynamic";

/** Session row for sticky chrome — null when signed out (public journal still gets search + browse). */
async function resolveJournalStickyUser(): Promise<HomeStickyChromeUser | null> {
	const session = await authServer();
	if (!session) return null;

	const profileResult = await fetchMeProfile();
	const profile = profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
	if (!profile?.handle) return null;

	return buildPatronNavUserOrNull(session, profile);
}

/**
 * Journal lobby chrome — same sticky header + `bg-card` canvas as diary, lists, and home.
 */
export default async function JournalLayout({
	children,
}: {
	children: ReactNode;
}) {
	const stickyUser = await resolveJournalStickyUser();

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				{children}
			</section>
		</div>
	);
}
