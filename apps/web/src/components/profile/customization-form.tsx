"use client";

import { cn } from "@still/ui/lib/utils";
import { Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { useRegisterMeAccountBarActions } from "@/components/profile/me-account-bar-actions-context";
import {
	MeAccountContentReveal,
	MeAccountRevealItem,
} from "@/components/profile/me-account-content-reveal";
import { useMeAccountSession } from "@/components/profile/me-account-session-context";
import { MeSecondaryButton } from "@/components/profile/me-secondary-button";
import { profileMeAvatarImageUrl } from "@/lib/profile-avatar";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import { uploadProfileMeAsset } from "@/lib/upload-profile-me-asset";

/** Placeholder banner wash when no image — matches `ProfilePatronHeader` default. */
const PROFILE_BANNER_PLACEHOLDER_ACCENT = "#c45c26";

type MeProfile = {
	bannerUrl: string | null;
	handle: string;
};

/** Load portrait via authenticated API (private Blob + cross-origin safe preview). */
async function fetchAvatarObjectUrl(revision: number): Promise<string | null> {
	const res = await fetch(profileMeAvatarImageUrl(revision), {
		credentials: "include",
		cache: "no-store",
	});
	if (!res.ok) return null;
	const blob = await res.blob();
	return URL.createObjectURL(blob);
}

/**
 * Customize page — profile-style preview; picks are staged until **Save** in the header.
 */
export function CustomizationForm({
	profile,
	hasAvatar: initialHasAvatar,
	displayName,
}: {
	profile: MeProfile;
	hasAvatar: boolean;
	displayName: string;
}) {
	const {
		pendingBanner,
		pendingAvatar,
		setPendingBanner,
		setPendingAvatar,
		revokeAllCustomizationPending,
		syncCustomizationDirty,
	} = useMeAccountSession();
	const [bannerUrl, setBannerUrl] = useState(profile.bannerUrl ?? "");
	const [bannerRevision, setBannerRevision] = useState(0);
	const [avatarRevision, setAvatarRevision] = useState(0);
	const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
	const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
	const [saving, setSaving] = useState(false);
	const bannerFileRef = useRef<HTMLInputElement>(null);
	const avatarFileRef = useRef<HTMLInputElement>(null);
	const avatarObjectUrlRef = useRef<string | null>(null);

	const hasBanner = Boolean(bannerUrl?.trim());
	const bannerSrc =
		profile.handle && hasBanner
			? profileBannerImageUrl(profile.handle, bannerRevision)
			: null;

	const dirty = Boolean(pendingBanner || pendingAvatar);

	useEffect(() => {
		syncCustomizationDirty(dirty);
	}, [dirty, syncCustomizationDirty]);

	const revokePending = useCallback(() => {
		revokeAllCustomizationPending();
	}, [revokeAllCustomizationPending]);

	const resetToServer = useCallback(() => {
		revokePending();
		setBannerUrl(profile.bannerUrl ?? "");
		setHasAvatar(initialHasAvatar);
		setBannerRevision((r) => r + 1);
		setAvatarRevision((r) => r + 1);
	}, [profile.bannerUrl, initialHasAvatar, revokePending]);

	const applySave = useCallback(async () => {
		if (!pendingBanner && !pendingAvatar) return;
		setSaving(true);
		try {
			if (pendingBanner) {
				const url = await uploadProfileMeAsset(
					"/api/profiles/me/banner",
					pendingBanner.file,
				);
				setPendingBanner(null);
				setBannerUrl(url);
				setBannerRevision(Date.now());
			}
			if (pendingAvatar) {
				await uploadProfileMeAsset(
					"/api/profiles/me/avatar",
					pendingAvatar.file,
				);
				setPendingAvatar(null);
				setHasAvatar(true);
				setAvatarRevision(Date.now());
			}
			toast.success("Saved");
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : "Couldn't save");
		} finally {
			setSaving(false);
		}
	}, [pendingBanner, pendingAvatar, setPendingAvatar, setPendingBanner]);

	useRegisterMeAccountBarActions(
		useMemo(
			() => ({
				onSave: () => void applySave(),
				onCancel: resetToServer,
				canSave: dirty,
				saving,
			}),
			[applySave, dirty, resetToServer, saving],
		),
	);

	// Stream committed portrait when not editing a pending pick.
	useEffect(() => {
		if (pendingAvatar) return;

		if (!hasAvatar) {
			if (avatarObjectUrlRef.current) {
				URL.revokeObjectURL(avatarObjectUrlRef.current);
				avatarObjectUrlRef.current = null;
			}
			setAvatarObjectUrl(null);
			return;
		}

		let cancelled = false;
		void (async () => {
			const next = await fetchAvatarObjectUrl(avatarRevision);
			if (cancelled) {
				if (next) URL.revokeObjectURL(next);
				return;
			}
			if (avatarObjectUrlRef.current) {
				URL.revokeObjectURL(avatarObjectUrlRef.current);
			}
			avatarObjectUrlRef.current = next;
			setAvatarObjectUrl(next);
		})();

		return () => {
			cancelled = true;
		};
	}, [hasAvatar, avatarRevision, pendingAvatar]);

	useEffect(() => {
		return () => {
			if (avatarObjectUrlRef.current) {
				URL.revokeObjectURL(avatarObjectUrlRef.current);
			}
		};
	}, []);

	function onPickBannerFile(file: File) {
		const previewUrl = URL.createObjectURL(file);
		setPendingBanner({ file, previewUrl });
	}

	function onPickAvatarFile(file: File) {
		const previewUrl = URL.createObjectURL(file);
		setPendingAvatar({ file, previewUrl });
	}

	const portraitSrc = pendingAvatar?.previewUrl ?? avatarObjectUrl;

	return (
		<div>
			<MeAccountContentReveal className="space-y-0">
				<MeAccountRevealItem>
					<div className="pb-4">
						<header className="relative shrink-0">
							<div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted/25 shadow-md">
								{pendingBanner ? (
									// eslint-disable-next-line @next/next/no-img-element -- local file preview before save
									<img
										src={pendingBanner.previewUrl}
										alt=""
										className="absolute inset-0 size-full object-cover"
									/>
								) : bannerSrc ? (
									<Image
										key={bannerSrc}
										src={bannerSrc}
										alt=""
										fill
										unoptimized
										className="object-cover"
										sizes="(max-width: 1280px) 100vw, 1200px"
										priority
									/>
								) : (
									<div
										className="size-full"
										style={{
											background: `linear-gradient(120deg, ${PROFILE_BANNER_PLACEHOLDER_ACCENT}44, transparent 55%), var(--surface-card-base, var(--card))`,
										}}
										aria-hidden
									/>
								)}
								<div
									className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/90 via-card/20 to-transparent"
									aria-hidden
								/>
								<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
									<MeSecondaryButton
										type="button"
										onClick={() => bannerFileRef.current?.click()}
										disabled={saving}
										className={cn(
											// `MeSecondaryButton` uses `DETAIL_CANVAS_ON_CARD_HOVER_CLASS` (foreground/10) which reads hollow on top of a photo; force a solid raised pill.
											"bg-card/95 text-foreground shadow-md backdrop-blur-sm",
											"[@media(hover:hover)]:hover:bg-card! [@media(hover:hover)]:hover:text-foreground",
											"[@media(hover:hover)]:hover:shadow-lg",
										)}
									>
										<Upload className="size-4" aria-hidden />
										Choose banner
									</MeSecondaryButton>
								</div>
							</div>

							<div className="relative mx-auto -mt-14 max-w-md px-2 text-center sm:-mt-16 sm:px-4">
								<div className="mx-auto mb-4 flex justify-center">
									<button
										type="button"
										className={cn(
											"group relative aspect-[2/3] w-[5.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg ring-4 ring-card sm:w-24",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
											"disabled:pointer-events-none disabled:opacity-50",
										)}
										onClick={() => avatarFileRef.current?.click()}
										disabled={saving}
										aria-label="Change profile photo"
									>
										{portraitSrc ? (
											// eslint-disable-next-line @next/next/no-img-element -- blob preview or streamed avatar
											<img
												src={portraitSrc}
												alt=""
												className="relative z-0 size-full object-cover"
											/>
										) : (
											<PersonCreditPortrait
												name={displayName}
												profilePath={null}
												className="relative z-0 bg-muted/40"
												grayscale={false}
												sizes="96px"
											/>
										)}
										<span
											className={cn(
												"pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-card/80 via-transparent to-transparent pb-2 transition-opacity duration-200 ease-out",
												"opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
											)}
											aria-hidden
										>
											<span className="rounded-full bg-background/90 px-2.5 py-1 font-medium text-foreground text-xs">
												Edit
											</span>
										</span>
									</button>
								</div>

								<h1 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
									{displayName}
								</h1>
								<p className="text-muted-foreground text-sm">
									@{profile.handle}
								</p>
								<p className="mt-3 text-balance text-muted-foreground text-sm leading-relaxed">
									Choose a banner or portrait, then use Save in the header to
									apply. Cancel drops unstaged picks.
								</p>
							</div>

							<input
								ref={bannerFileRef}
								type="file"
								accept="image/*"
								hidden
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) onPickBannerFile(file);
									e.target.value = "";
								}}
							/>
							<input
								ref={avatarFileRef}
								type="file"
								accept="image/*"
								hidden
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) onPickAvatarFile(file);
									e.target.value = "";
								}}
							/>
						</header>
					</div>
				</MeAccountRevealItem>
			</MeAccountContentReveal>
		</div>
	);
}
