import type { SettingsProfile } from "@/components/profile/settings-form-context";
import { SettingsFormShell } from "@/components/profile/settings-form-shell";
import { serverApi } from "@/lib/server-api";

export default async function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const api = await serverApi();
	const me = await api.api.profiles.me.get().catch(() => ({ data: null }));

	if (!me.data) {
		return null;
	}

	const profile: SettingsProfile = {
		handle: me.data.handle,
		displayName: me.data.displayName,
		bio: me.data.bio,
		pronouns: me.data.pronouns,
		location: me.data.location,
		website: me.data.website,
		isPrivate: Boolean(me.data.isPrivate),
		isPro: Boolean(me.data.isPro),
		accentColor: me.data.accentColor,
		preferences: me.data.preferences,
		defaultVisibility: me.data.defaultVisibility,
	};

	return <SettingsFormShell profile={profile}>{children}</SettingsFormShell>;
}
