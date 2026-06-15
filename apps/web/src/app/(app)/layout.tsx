import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { AppThemeShell } from "@/components/app/app-theme-shell";
import { PublicShareShell } from "@/components/app/public-share-shell";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { ImpersonationBanner } from "@/components/staff/impersonation-banner";
import { authServer } from "@/lib/auth-server";
import {
	fetchMeProfile,
	type MeProfile,
	PROFILE_FETCH_FAILED,
} from "@/lib/fetch-me-profile";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";
import { buildPatronNavUser } from "@/lib/patron-nav-user";
import { isShareableAppPath } from "@/lib/shareable-app-paths";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
	const session = await authServer();
	const pathname =
		(await headers()).get("x-still-pathname")?.split("?")[0] ?? "";
	const isPublicShareRoute = isShareableAppPath(pathname);

	// Film/TV/profile pages must render for link-preview crawlers (no session cookie).
	if (!session && isPublicShareRoute) {
		return (
			<AppThemeShell initialAppearance={null} isPro={false}>
				<PublicShareShell>{children}</PublicShareShell>
			</AppThemeShell>
		);
	}

	// Redirect through /signed-out (a Route Handler) rather than straight to
	// /sign-in: a banned/revoked session leaves a stale cookie in the browser,
	// and the proxy gates on cookie *presence*, so a direct /sign-in redirect
	// bounces back to /home in an infinite loop. /signed-out clears the cookie
	// first, breaking the loop.
	if (!session) redirect("/signed-out");

	const profileResult = await fetchMeProfile();
	const profileFetchFailed = profileResult === PROFILE_FETCH_FAILED;
	const profile: MeProfile = profileFetchFailed ? null : profileResult;
	if (!profileFetchFailed && patronNeedsOnboarding(profile)) {
		redirect("/onboarding");
	}

	const impersonatedBy = session.session.impersonatedBy ?? null;
	// While impersonating, `session.user` is the impersonated account.
	const impersonatedName =
		session.user.name || session.user.email || "this account";

	return (
		<AppThemeShell
			initialAppearance={profile?.preferences ?? null}
			isPro={Boolean(profile?.isPro)}
		>
			{impersonatedBy ? <ImpersonationBanner name={impersonatedName} /> : null}
			<VerifyEmailBanner session={session} />
			<AppShell user={buildPatronNavUser(session, profile)}>
				{children}
			</AppShell>
		</AppThemeShell>
	);
}
