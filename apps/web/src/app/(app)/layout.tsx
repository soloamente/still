import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { authServer } from "@/lib/auth-server";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
	const session = await authServer();
	if (!session) redirect("/sign-in");

	const api = await serverApi();
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));
	const profile =
		(profileRes.data as { handle?: string; displayName?: string } | null) ??
		null;

	// First-run users with no profile yet get nudged to onboarding.
	if (!profile?.handle) redirect("/onboarding");

	return (
		<AppShell
			user={{
				id: session.user.id,
				name: session.user.name ?? profile.displayName ?? "",
				image: session.user.image ?? null,
				handle: profile.handle,
				email: session.user.email ?? null,
			}}
		>
			{children}
		</AppShell>
	);
}
