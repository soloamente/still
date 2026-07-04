import type { SettingsProfile } from "@/components/profile/settings-form-context";
import { SettingsFormShell } from "@/components/profile/settings-form-shell";
import { authServer } from "@/lib/auth-server";
import { buildPatronEntitlementsFromProfile } from "@/lib/patron-entitlements";
import { serverApi } from "@/lib/server-api";

export default async function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await authServer();
	const api = await serverApi();
	const me = await api.api.profiles.me.get().catch(() => ({ data: null }));

	if (!me.data) {
		return null;
	}

	const entitlements = buildPatronEntitlementsFromProfile({
		...me.data,
		isPro: Boolean(me.data.isPro),
	});

	const profile: SettingsProfile = {
		handle: me.data.handle,
		displayName: me.data.displayName,
		bio: me.data.bio,
		pronouns: me.data.pronouns,
		location: me.data.location,
		website: me.data.website,
		isPrivate: Boolean(me.data.isPrivate),
		isPro: entitlements.isPro,
		effectiveTier: entitlements.effectiveTier,
		featureGrants: [...entitlements.featureGrants],
		accentColor: me.data.accentColor,
		preferences: me.data.preferences,
		defaultVisibility: me.data.defaultVisibility,
		birthDate: typeof me.data.birthDate === "string" ? me.data.birthDate : null,
		bannerUrl: me.data.bannerUrl ?? null,
		hasAvatar: Boolean(session?.user.image?.trim()),
	};

	return <SettingsFormShell profile={profile}>{children}</SettingsFormShell>;
}
