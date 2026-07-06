import type { SettingsProfile } from "@/components/profile/settings-form-context";
import { SettingsFormShell } from "@/components/profile/settings-form-shell";
import type { ContentVisibility } from "@/components/review/visibility-select";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { buildPatronEntitlementsFromProfile } from "@/lib/patron-entitlements";

export default async function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await authServer();
	const me = await fetchMeProfile();

	if (!me || me === PROFILE_FETCH_FAILED) {
		return null;
	}

	const entitlements = buildPatronEntitlementsFromProfile(me);

	const profile: SettingsProfile = {
		handle: me.handle,
		displayName: me.displayName,
		bio: me.bio ?? null,
		pronouns: me.pronouns ?? null,
		location: me.location ?? null,
		website: me.website ?? null,
		isPrivate: Boolean(me.isPrivate),
		isPro: entitlements.isPro,
		effectiveTier: entitlements.effectiveTier,
		featureGrants: [...entitlements.featureGrants],
		subscriptionTier: entitlements.subscriptionTier,
		planOverride: entitlements.planOverride,
		subscriptionInterval:
			me.subscriptionInterval === "month" || me.subscriptionInterval === "year"
				? me.subscriptionInterval
				: null,
		subscriptionStatus:
			me.subscriptionStatus === "active" ||
			me.subscriptionStatus === "past_due" ||
			me.subscriptionStatus === "canceled"
				? me.subscriptionStatus
				: null,
		polarSubscriptionId:
			typeof me.polarSubscriptionId === "string"
				? me.polarSubscriptionId
				: null,
		accentColor: me.accentColor ?? null,
		preferences: me.preferences,
		defaultVisibility:
			me.defaultVisibility === "public" ||
			me.defaultVisibility === "followers" ||
			me.defaultVisibility === "friends" ||
			me.defaultVisibility === "private"
				? (me.defaultVisibility as ContentVisibility)
				: null,
		birthDate: typeof me.birthDate === "string" ? me.birthDate : null,
		bannerUrl: me.bannerUrl ?? null,
		hasAvatar: Boolean(session?.user.image?.trim()),
	};

	return <SettingsFormShell profile={profile}>{children}</SettingsFormShell>;
}
