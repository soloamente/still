import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { AppThemeShell } from "@/components/app/app-theme-shell";
import { authServer } from "@/lib/auth-server";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
	const session = await authServer();
	if (!session) redirect("/sign-in");

	const api = await serverApi();
	let profile: {
		handle?: string;
		displayName?: string;
		preferences?: Record<string, unknown>;
		isPro?: boolean;
	} | null = null;
	let profileFetchFailed = false;
	try {
		const profileRes = await api.api.profiles.me.get();
		if (profileRes.error) {
			profileFetchFailed = true;
			console.error("[app layout] profiles.me error", profileRes.error);
		} else {
			profile =
				(profileRes.data as { handle?: string; displayName?: string } | null) ??
				null;
		}
	} catch (err) {
		profileFetchFailed = true;
		console.error("[app layout] profiles.me failed", err);
	}

	// First-run users with no profile yet get nudged to onboarding.
	// When the API/DB is down, do not bounce between `/home` ↔ `/onboarding` (307 loops).
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
