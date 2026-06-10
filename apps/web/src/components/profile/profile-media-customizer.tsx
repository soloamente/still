"use client";

import { cn } from "@still/ui/lib/utils";
import { Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useMeAccountSession } from "@/components/profile/me-account-session-context";
import { MeSecondaryButton } from "@/components/profile/me-secondary-button";
import { profilePatronAvatarImageUrl } from "@/lib/profile-avatar";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import {
	assertProfileMediaUploadSize,
	profileMediaCacheKey,
} from "@/lib/profile-media-cache-key";

/** Placeholder banner wash when no image — matches `ProfilePatronHeader` default. */
const PROFILE_BANNER_PLACEHOLDER_ACCENT = "#c45c26";

type ProfileMediaCustomizerProps = {
	handle: string;
	bannerUrl: string | null;
	hasAvatar: boolean;
	/** Shows Pro GIF upload helper when the patron has Sense Pro. */
	isPro?: boolean;
	/** Disables pickers while the settings form is saving. */
	disabled?: boolean;
};

/**
 * Banner + portrait pickers for Settings → Profile.
 * Staged files live in `MeAccountSession` until the header Save runs.
 */
export function ProfileMediaCustomizer({
	handle,
	bannerUrl: initialBannerUrl,
	hasAvatar: initialHasAvatar,
	isPro = false,
	disabled = false,
}: ProfileMediaCustomizerProps) {
	const {
		pendingBanner,
		pendingAvatar,
		setPendingBanner,
		setPendingAvatar,
		syncCustomizationDirty,
	} = useMeAccountSession();

	const [bannerUrl, setBannerUrl] = useState(initialBannerUrl ?? "");
	const [bannerRevision, setBannerRevision] = useState(0);
	const [avatarRevision, setAvatarRevision] = useState(0);
	const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
	const bannerFileRef = useRef<HTMLInputElement>(null);
	const avatarFileRef = useRef<HTMLInputElement>(null);

	const hasBanner = Boolean(bannerUrl?.trim());
	const bannerSrc =
		handle && hasBanner
			? profileBannerImageUrl(
					handle,
					profileMediaCacheKey(bannerUrl) ?? bannerRevision,
				)
			: null;

	const mediaDirty = Boolean(pendingBanner || pendingAvatar);

	// Re-sync when RSC refetches after save (router.refresh).
	useEffect(() => {
		setBannerUrl(initialBannerUrl ?? "");
		setHasAvatar(initialHasAvatar);
		setBannerRevision((r) => r + 1);
		setAvatarRevision((r) => r + 1);
	}, [initialBannerUrl, initialHasAvatar]);

	const onPickBannerFile = useCallback(
		(file: File) => {
			try {
				assertProfileMediaUploadSize(file);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "File too large");
				return;
			}
			const previewUrl = URL.createObjectURL(file);
			setPendingBanner({ file, previewUrl });
		},
		[setPendingBanner],
	);

	const onPickAvatarFile = useCallback(
		(file: File) => {
			try {
				assertProfileMediaUploadSize(file);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "File too large");
				return;
			}
			const previewUrl = URL.createObjectURL(file);
			setPendingAvatar({ file, previewUrl });
		},
		[setPendingAvatar],
	);

	// Stream committed portrait when not editing a pending pick.
	const committedPortraitSrc =
		hasAvatar && handle
			? profilePatronAvatarImageUrl(handle, avatarRevision)
			: null;

	const portraitSrc = pendingAvatar?.previewUrl ?? committedPortraitSrc;

	useEffect(() => {
		syncCustomizationDirty(mediaDirty);
	}, [mediaDirty, syncCustomizationDirty]);

	return (
		<header className="relative mb-8 shrink-0">
			<div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted/25">
				{pendingBanner ? (
					// biome-ignore lint/performance/noImgElement: local file preview before save
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
						disabled={disabled}
						className={cn(
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
							"group relative aspect-[2/3] w-[5.5rem] overflow-hidden rounded-2xl shadow-lg ring-4 ring-card sm:w-24",
							portraitSrc ? "bg-muted/30" : "bg-card",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
							"disabled:pointer-events-none disabled:opacity-50",
						)}
						onClick={() => avatarFileRef.current?.click()}
						disabled={disabled}
						aria-label={
							portraitSrc ? "Change profile photo" : "Add profile photo"
						}
					>
						{portraitSrc ? (
							// biome-ignore lint/performance/noImgElement: blob preview or streamed avatar
							<img
								src={portraitSrc}
								alt=""
								className="relative z-0 size-full object-cover"
							/>
						) : (
							// Raised card tile — must read as tappable on `bg-background` settings panels.
							<span className="relative z-0 flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
								<Upload
									className="size-5 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<span className="font-medium text-foreground text-xs">
									Add photo
								</span>
							</span>
						)}
						{portraitSrc ? (
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
						) : null}
					</button>
				</div>

				<p className="text-balance text-muted-foreground text-sm leading-relaxed">
					Choose a banner or portrait, then use Save in the header to apply.
					Cancel drops unstaged picks.
				</p>
				{isPro ? (
					<p className="mt-2 text-balance text-muted-foreground text-sm leading-relaxed">
						Sense Pro: upload animated GIF for banner and portrait.
					</p>
				) : null}
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
	);
}
