"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { DEFAULT_APP_THEME_CLASS, resolveAppTheme } from "@/lib/app-themes";
import { resolveStudioThemedLogoUrl } from "@/lib/search-dialog-studio-logo";
import {
	SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
	SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS,
} from "@/lib/search-dialog-studios";

type SearchDialogStudioLogoVariant =
	| "rail"
	| "suggestion"
	| "pill"
	| "pillCompact";

const VARIANT_CLASS: Record<
	SearchDialogStudioLogoVariant,
	{ frame: string; image: string }
> = {
	rail: {
		frame: SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS,
		image: `${SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS} object-cover`,
	},
	suggestion: {
		frame: "size-9 rounded-lg",
		image: "size-9 rounded-lg object-cover",
	},
	pill: {
		frame: "size-5 rounded-md",
		image: "size-5 rounded-md object-cover",
	},
	pillCompact: {
		frame: "size-4 rounded-[5px]",
		image: "size-4 rounded-[5px] object-cover",
	},
};

/**
 * Studio mark for search UI — prefers baked `public/studios/{slug}/{slug}_{theme}.png`
 * tiles (background included) and falls back to TMDb `logo_url` on missing assets.
 */
export function SearchDialogStudioLogo({
	studioId,
	fallbackLogoUrl,
	variant = "rail",
	className,
}: {
	studioId: number;
	fallbackLogoUrl: string | null;
	variant?: SearchDialogStudioLogoVariant;
	className?: string;
}) {
	const { theme, resolvedTheme } = useTheme();
	const appTheme = resolveAppTheme(
		resolvedTheme ?? theme ?? DEFAULT_APP_THEME_CLASS,
	);
	const themedUrl = useMemo(
		() => resolveStudioThemedLogoUrl(studioId, appTheme),
		[studioId, appTheme],
	);
	const prefersThemedTile = themedUrl != null;
	const [src, setSrc] = useState(() => themedUrl ?? fallbackLogoUrl ?? "");
	const [useChipSurface, setUseChipSurface] = useState(!prefersThemedTile);

	useEffect(() => {
		if (prefersThemedTile) {
			setSrc(themedUrl);
			setUseChipSurface(false);
			return;
		}
		setSrc(fallbackLogoUrl ?? "");
		setUseChipSurface(true);
	}, [prefersThemedTile, themedUrl, fallbackLogoUrl]);

	if (!src) return null;

	const { frame, image } = VARIANT_CLASS[variant];
	const isRemote = src.startsWith("http");

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden",
				frame,
				useChipSurface && [
					SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
					variant === "suggestion" && "studio-logo-chip-outline shadow-sm",
				],
				className,
			)}
		>
			<Image
				src={src}
				alt=""
				width={variant === "rail" ? 64 : variant === "suggestion" ? 36 : 20}
				height={variant === "rail" ? 64 : variant === "suggestion" ? 36 : 20}
				className={cn(
					useChipSurface ? "object-contain p-0.5" : image,
					useChipSurface && variant === "rail" && "size-14 p-1.5",
					useChipSurface && variant === "suggestion" && "size-7 p-0.5",
				)}
				unoptimized={isRemote}
				onError={() => {
					if (prefersThemedTile && fallbackLogoUrl) {
						setSrc(fallbackLogoUrl);
						setUseChipSurface(true);
					}
				}}
			/>
		</span>
	);
}
