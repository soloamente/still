"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import type { CSSProperties } from "react";
import { profilePatronAvatarImageUrl } from "@/lib/profile-avatar";
import { profileMediaCacheKey } from "@/lib/profile-media-cache-key";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type PatronPortraitAvatarProps = {
	handle: string;
	/** Raw `user.image` — only used to detect presence; `src` always goes through the API proxy. */
	avatarUrl: string | null | undefined;
	name: string;
	className?: string;
	style?: CSSProperties;
	width?: number;
	height?: number;
	/** When true, render a native `<img>` so animated GIF/WebP avatars can play. */
	isAnimated?: boolean;
	/** Desaturate until pointer hover on hover-capable devices. */
	grayscaleUntilHover?: boolean;
	/** When true (default), honor `prefers-reduced-motion` for animated avatars. */
	respectReducedMotion?: boolean;
};

/**
 * Patron portrait — same loading contract as `ProfilePatronHeader`:
 * proxy via `GET /api/profiles/avatar/:handle` and `unoptimized` (dev localhost is a private IP).
 */
export function PatronPortraitAvatar({
	handle,
	avatarUrl,
	name,
	className,
	style,
	width = 72,
	height = 72,
	isAnimated = false,
	grayscaleUntilHover = false,
	respectReducedMotion = true,
}: PatronPortraitAvatarProps) {
	const reducedMotion = usePrefersReducedMotion();

	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join("");

	const portraitSrc = avatarUrl?.trim()
		? profilePatronAvatarImageUrl(handle, profileMediaCacheKey(avatarUrl))
		: null;

	const portraitClassName = cn(
		"object-cover",
		grayscaleUntilHover && "grayscale [@media(hover:hover)]:hover:grayscale-0",
		className,
	);

	/** Profile lobby poster tile passes `size-full` — use fill layout, not fixed width/height. */
	const fillsContainer = Boolean(className?.includes("size-full"));

	if (portraitSrc) {
		// Animated avatars need a native <img> — Next/Image can strip or freeze GIF frames.
		if (isAnimated) {
			// Best-effort reduced motion: when respectReducedMotion && reducedMotion, we still
			// use <img> because there is no reliable way to pause remote GIF/WebP animation.
			const reducedMotionActive = respectReducedMotion && reducedMotion;

			return (
				// eslint-disable-next-line @next/next/no-img-element -- animated patron portraits must use native img
				// biome-ignore lint/performance/noImgElement: animated GIF/WebP avatars require native img
				<img
					src={portraitSrc}
					alt=""
					{...(fillsContainer ? {} : { width, height })}
					style={fillsContainer ? undefined : style}
					data-reduced-motion={reducedMotionActive ? "" : undefined}
					className={cn(fillsContainer && "block size-full", portraitClassName)}
				/>
			);
		}

		if (fillsContainer) {
			return (
				<Image
					src={portraitSrc}
					alt=""
					fill
					unoptimized
					className={portraitClassName}
					sizes="96px"
				/>
			);
		}

		return (
			<Image
				src={portraitSrc}
				alt=""
				width={width}
				height={height}
				style={style}
				unoptimized
				className={portraitClassName}
			/>
		);
	}

	return (
		<span
			style={style}
			className={cn(
				"inline-flex items-center justify-center rounded-full bg-soft-stone font-medium text-pure-white",
				className,
			)}
			aria-hidden
		>
			{initials}
		</span>
	);
}
