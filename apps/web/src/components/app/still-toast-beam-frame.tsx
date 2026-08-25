"use client";

import { stillToastLeadingIcons } from "@still/ui/components/sonner";
import { cn } from "@still/ui/lib/utils";
import { BorderBeam } from "border-beam";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { APP_THEME_CLASS_LOBBY_LIGHT } from "@/lib/app-themes";

export type StillToastBeamType =
	| "success"
	| "error"
	| "warning"
	| "info"
	| "loading"
	| "default";

/** Map toast kind → border-beam palette; status hue is finished in CSS. */
function beamColorVariant(
	type: StillToastBeamType,
): "colorful" | "mono" | "ocean" | "sunset" {
	switch (type) {
		case "success":
			return "colorful";
		case "error":
			// Red paint lives in CSS; mono base avoids orange sunset bleed.
			return "mono";
		case "warning":
			return "sunset";
		case "info":
			return "ocean";
		case "loading":
		case "default":
			return "mono";
		default: {
			const _exhaustive: never = type;
			return _exhaustive;
		}
	}
}

function leadingIcon(type: StillToastBeamType): ReactNode {
	switch (type) {
		case "success":
			return stillToastLeadingIcons.added;
		case "error":
			return stillToastLeadingIcons.error;
		case "warning":
			return stillToastLeadingIcons.warning;
		case "info":
			return stillToastLeadingIcons.info;
		case "loading":
			return stillToastLeadingIcons.loading;
		case "default":
			return stillToastLeadingIcons.info;
		default: {
			const _exhaustive: never = type;
			return _exhaustive;
		}
	}
}

/**
 * Sonner custom toast shell — theme `bg-card` pill + BorderBeam rotate (`sm`)
 * with hue-shift pulse (not `staticColors`). Compact stroke; bloom stays off
 * so the fill is not washed. Beam hue via `data-still-toast-beam`.
 */
export function StillToastBeamFrame({
	type,
	title,
	description,
	icon,
}: {
	type: StillToastBeamType;
	title: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const { resolvedTheme } = useTheme();
	const beamTheme =
		resolvedTheme === APP_THEME_CLASS_LOBBY_LIGHT || resolvedTheme === "light"
			? "light"
			: "dark";

	return (
		<BorderBeam
			// Compact perimeter stroke for short toast pills (not full-card `md`).
			size="sm"
			colorVariant={beamColorVariant(type)}
			// Rotate pulse: hue-shift while the stroke travels. Error keeps a pinned red paint.
			staticColors={type === "error"}
			theme={beamTheme}
			// Match stadium clip to the pill (half-height ≈ 20–24; 9999 is fine for round).
			borderRadius={9999}
			active={!reduceMotion}
			duration={2.2}
			hueRange={30}
			// Prop clamps to 1; real bump is `--beam-strength` in globals.css.
			strength={1}
			brightness={1.6}
			saturation={1.5}
			data-still-toast-beam={type}
			className={cn(
				"still-toast-beam pointer-events-auto w-max max-w-[min(420px,calc(100vw-32px))]",
				// Clip stroke to the pill — do not let bloom/filters spill past Sonner.
				"overflow-hidden rounded-full",
			)}
		>
			{/*
			  Do NOT put z-index on this child — BorderBeam’s stroke sits at
			  z-index 2; a higher child covers the traveling beam entirely.
			*/}
			<div
				className={cn(
					"flex w-max max-w-[min(420px,calc(100vw-32px))] items-center gap-2.5",
					"rounded-full bg-card py-2.5 pr-3.5 pl-2.5 text-card-foreground",
					"select-none font-sans text-[13px] leading-snug tracking-normal",
					"shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--foreground)_18%,transparent)]",
				)}
			>
				<span
					className={cn(
						"flex shrink-0 items-center justify-center",
						type === "error" ? "size-5" : "size-7",
					)}
				>
					{icon ?? leadingIcon(type)}
				</span>
				<div className="min-w-0 text-left">
					<div className="font-normal text-inherit leading-snug">{title}</div>
					{description ? (
						<div className="mt-0.5 text-[13px] text-muted-foreground leading-snug">
							{description}
						</div>
					) : null}
				</div>
			</div>
		</BorderBeam>
	);
}
