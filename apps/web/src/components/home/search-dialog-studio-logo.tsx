"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import {
	DEFAULT_APP_THEME_CLASS,
	isAppThemeLight,
	resolveAppTheme,
} from "@/lib/app-themes";
import { resolveStudioThemedLogoUrl } from "@/lib/search-dialog-studio-logo";
import {
	SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
	SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS,
} from "@/lib/search-dialog-studios";

type SearchDialogStudioLogoVariant =
	| "rail"
	| "suggestion"
	| "pill"
	| "pillCompact"
	| "pillTiny";

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
	pillTiny: {
		frame: "size-8 rounded-full",
		image: "size-8 rounded-full object-cover",
	},
};

function variantPixelSize(variant: SearchDialogStudioLogoVariant): number {
	switch (variant) {
		case "rail":
			return 64;
		case "suggestion":
			return 36;
		case "pillCompact":
			return 18;
		case "pill":
			return 20;
		case "pillTiny":
			return 32;
		default: {
			const _exhaustive: never = variant;
			return _exhaustive;
		}
	}
}

/**
 * Studio mark for search UI — prefers TMDb `logo_url` from the API; falls back to
 * baked `public/studios/{slug}/{slug}_{theme}.png` tiles when the API has no logo.
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
	// API logo first; themed PNG only when TMDb has nothing.
	const prefersApiLogo = Boolean(fallbackLogoUrl);
	const [src, setSrc] = useState(
		() => fallbackLogoUrl ?? themedUrl ?? "",
	);
	const [useChipSurface, setUseChipSurface] = useState(prefersApiLogo);

	useEffect(() => {
		if (fallbackLogoUrl) {
			setSrc(fallbackLogoUrl);
			setUseChipSurface(true);
			return;
		}
		setSrc(themedUrl ?? "");
		setUseChipSurface(false);
	}, [fallbackLogoUrl, themedUrl]);

	if (!src) return null;

	const { frame, image } = VARIANT_CLASS[variant];
	const isRemote = src.startsWith("http");
	const pixelSize = variantPixelSize(variant);
	// TMDb company logos are dark ink — invert to white on dark shells (not Lucid).
	const invertApiLogoForDark = useChipSurface && !isAppThemeLight(appTheme);

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden",
				frame,
				// Search-bar tag marks sit on `bg-background` pills — match the raised shell.
				useChipSurface &&
					variant === "pillTiny" &&
					"bg-card",
				useChipSurface &&
					variant !== "pillTiny" && [
						SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
						variant === "suggestion" && "studio-logo-chip-outline shadow-sm",
					],
				className,
			)}
		>
			<Image
				src={src}
				alt=""
				width={pixelSize}
				height={pixelSize}
				className={cn(
					useChipSurface ? "object-contain p-0.5" : image,
					useChipSurface && variant === "rail" && "size-14 p-1.5",
					useChipSurface && variant === "suggestion" && "size-8 p-0.5",
					useChipSurface && variant === "pillTiny" && "size-7 p-0.5",
					invertApiLogoForDark && "brightness-0 invert",
				)}
				unoptimized={isRemote}
				onError={() => {
					// API logo failed — try themed tile if we have one.
					if (fallbackLogoUrl && themedUrl && src === fallbackLogoUrl) {
						setSrc(themedUrl);
						setUseChipSurface(false);
					}
				}}
			/>
		</span>
	);
}
