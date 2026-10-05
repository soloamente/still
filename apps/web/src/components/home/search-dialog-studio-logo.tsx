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
	searchDialogStudioPillLogoDevUrl,
	searchDialogStudioPillUsesLogoDev,
} from "@/lib/search-dialog-studio-logo-dev";
import {
	SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
	SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS,
} from "@/lib/search-dialog-studios";

type SearchDialogStudioLogoVariant =
	| "rail"
	| "suggestion"
	| "pill"
	| "pillCompact"
	| "pillRecent"
	| "pillTiny"
	| "pillDialog";

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
	pillRecent: {
		frame: "size-7 rounded-full",
		image: "size-7 rounded-full object-cover",
	},
	pillTiny: {
		frame: "size-8 rounded-full",
		image: "size-8 rounded-full object-cover",
	},
	/** ⌘K dialog tag row — fills h-10 chip minus py-1.5 (28px). */
	pillDialog: {
		frame: "size-7 rounded-full",
		image: "size-7 rounded-full object-cover",
	},
};

/** Initials when every remote source fails or none is configured. */
function studioMonogramLabel(studioName: string): string {
	const trimmed = studioName.trim();
	if (!trimmed) return "?";
	const words = trimmed.split(/\s+/).filter(Boolean);
	if (words.length >= 2) {
		return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
	}
	return trimmed.slice(0, 2).toUpperCase();
}

function SearchDialogStudioMonogram({
	studioName,
	variant,
	className,
}: {
	studioName: string;
	variant: SearchDialogStudioLogoVariant;
	className?: string;
}) {
	const { frame } = VARIANT_CLASS[variant];
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden bg-card font-medium text-foreground",
				frame,
				variant === "pillCompact" && "text-[9px]",
				variant === "pill" && "text-[10px]",
				(variant === "pillRecent" ||
					variant === "pillDialog" ||
					variant === "pillTiny") &&
					"text-xs",
				variant === "suggestion" && "text-sm",
				variant === "rail" && "text-base",
				className,
			)}
			aria-hidden
		>
			{studioMonogramLabel(studioName)}
		</span>
	);
}

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
		case "pillRecent":
			return 28;
		case "pillTiny":
			return 32;
		case "pillDialog":
			return 28;
		default: {
			const _exhaustive: never = variant;
			return _exhaustive;
		}
	}
}

/**
 * Studio mark for search UI — pill variants prefer Logo.dev JPG (logo + plate);
 * rail keeps themed PNG / TMDb. Falls back to TMDb `logo_url`, then theme tiles.
 */
export function SearchDialogStudioLogo({
	studioId,
	studioName,
	fallbackLogoUrl,
	variant = "rail",
	className,
}: {
	studioId: number;
	studioName: string;
	fallbackLogoUrl: string | null;
	variant?: SearchDialogStudioLogoVariant;
	className?: string;
}) {
	const { theme, resolvedTheme } = useTheme();
	const appTheme = resolveAppTheme(
		resolvedTheme ?? theme ?? DEFAULT_APP_THEME_CLASS,
	);
	const tmdbLogoUrl = fallbackLogoUrl?.trim() || null;
	const themedUrl = useMemo(
		() => resolveStudioThemedLogoUrl(studioId, appTheme),
		[studioId, appTheme],
	);

	const logoDevUrl = useMemo(() => {
		if (!searchDialogStudioPillUsesLogoDev(variant)) return null;
		return searchDialogStudioPillLogoDevUrl({
			studioId,
			studioName,
			size: variant,
		});
	}, [studioId, studioName, variant]);

	const [src, setSrc] = useState(
		() => logoDevUrl ?? tmdbLogoUrl ?? themedUrl ?? "",
	);
	const [sourceKind, setSourceKind] = useState<"logoDev" | "tmdb" | "themed">(
		() => {
			if (logoDevUrl) return "logoDev";
			if (tmdbLogoUrl) return "tmdb";
			return "themed";
		},
	);
	const [sourcesExhausted, setSourcesExhausted] = useState(false);

	useEffect(() => {
		setSourcesExhausted(false);
		if (logoDevUrl) {
			setSrc(logoDevUrl);
			setSourceKind("logoDev");
			return;
		}
		if (tmdbLogoUrl) {
			setSrc(tmdbLogoUrl);
			setSourceKind("tmdb");
			return;
		}
		setSrc(themedUrl ?? "");
		setSourceKind("themed");
	}, [logoDevUrl, tmdbLogoUrl, themedUrl]);

	if (sourcesExhausted || !src) {
		return (
			<SearchDialogStudioMonogram
				studioName={studioName}
				variant={variant}
				className={className}
			/>
		);
	}

	const { frame, image } = VARIANT_CLASS[variant];
	const isRemote = src.startsWith("http");
	const pixelSize = variantPixelSize(variant);
	const usesLogoDevPlate = sourceKind === "logoDev";
	// TMDb company logos are dark ink — invert to white on dark shells (not Lucid).
	const invertApiLogoForDark =
		sourceKind === "tmdb" && !isAppThemeLight(appTheme);

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden",
				frame,
				// Logo.dev JPG already includes a light plate — skip nested chip tint.
				sourceKind === "tmdb" &&
					(variant === "pillTiny" || variant === "pillDialog") &&
					"bg-card",
				sourceKind === "tmdb" &&
					variant !== "pillTiny" &&
					variant !== "pillDialog" &&
					variant !== "pillRecent" && [
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
					usesLogoDevPlate && "size-full object-cover",
					!usesLogoDevPlate && sourceKind === "tmdb" && "object-contain p-0.5",
					!usesLogoDevPlate && sourceKind === "themed" && image,
					sourceKind === "tmdb" && variant === "rail" && "size-14 p-1.5",
					sourceKind === "tmdb" && variant === "suggestion" && "size-8 p-0.5",
					sourceKind === "tmdb" &&
						(variant === "pillTiny" || variant === "pillDialog") &&
						"size-full p-0.5",
					sourceKind === "tmdb" &&
						variant === "pillRecent" &&
						"size-full object-contain p-0.5",
					invertApiLogoForDark && "brightness-0 invert",
				)}
				unoptimized={isRemote}
				onError={() => {
					if (sourceKind === "logoDev") {
						if (tmdbLogoUrl) {
							setSrc(tmdbLogoUrl);
							setSourceKind("tmdb");
							return;
						}
						if (themedUrl) {
							setSrc(themedUrl);
							setSourceKind("themed");
							return;
						}
						setSourcesExhausted(true);
						return;
					}
					if (sourceKind === "tmdb") {
						if (themedUrl && src !== themedUrl) {
							setSrc(themedUrl);
							setSourceKind("themed");
							return;
						}
						setSourcesExhausted(true);
						return;
					}
					setSourcesExhausted(true);
				}}
			/>
		</span>
	);
}
