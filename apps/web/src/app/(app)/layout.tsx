import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { AppThemeShell } from "@/components/app/app-theme-shell";
import { authServer } from "@/lib/auth-server";
import {
	fetchMeProfile,
	type MeProfile,
	PROFILE_FETCH_FAILED,
} from "@/lib/fetch-me-profile";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
	const session = await authServer();
	if (!session) redirect("/sign-in");

	const profileResult = await fetchMeProfile();
	const profileFetchFailed = profileResult === PROFILE_FETCH_FAILED;
	const profile: MeProfile = profileFetchFailed ? null : profileResult;
	if (!profileFetchFailed && !profile?.handle) redirect("/onboarding");

	return (
		<AppThemeShell
			initialAppearance={profile?.preferences ?? null}
			isPro={Boolean(profile?.isPro)}
		>
			<AppShell
				user={{
					id: session.user.id,
					name: session.user.name ?? profile?.displayName ?? "",
					image: session.user.image ?? null,
					handle: profile?.handle ?? session.user.id,
					email: session.user.email ?? null,
					isPro: Boolean(profile?.isPro),
				}}
			>
				{children}
			</AppShell>
		</AppThemeShell>
	);
}
