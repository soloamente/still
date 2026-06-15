import type { AccountMenuUser } from "@/components/app/app-user-account-menu";
import type { ServerSession } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { resolvePatronAvatarIsAnimated } from "@/lib/profile-media";

/**
 * Build nav / account-menu identity from profile + session.
 * Profile wins for display name and portrait URL so onboarding and settings
 * updates show immediately even when the auth session snapshot is stale.
 */
export function buildPatronNavUser(
	session: ServerSession,
	profile: MeProfile | null | undefined,
): AccountMenuUser {
	const handle = profile?.handle?.trim() || session.user.id;
	const name =
		profile?.displayName?.trim() ||
		session.user.name?.trim() ||
		session.user.email?.split("@")[0] ||
		"You";
	const image = profile?.image?.trim() || session.user.image?.trim() || null;

	return {
		id: session.user.id,
		name,
		image,
		handle,
		email: session.user.email ?? null,
		isPro: Boolean(profile?.isPro),
		avatarIsAnimated: resolvePatronAvatarIsAnimated(
			image,
			profile?.preferences ?? null,
		),
		diaryMetalTier: profile?.diaryMetalTier ?? null,
	};
}

/** Sticky chrome and other surfaces that hide the account block without a handle. */
export function buildPatronNavUserOrNull(
	session: ServerSession | null,
	profile: MeProfile | null | undefined,
): AccountMenuUser | null {
	if (!session || !profile?.handle?.trim()) return null;
	return buildPatronNavUser(session, profile);
}
