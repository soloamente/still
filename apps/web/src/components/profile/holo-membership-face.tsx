"use client";

import { cn } from "@still/ui/lib/utils";
import type { CSSProperties, ReactNode, Ref } from "react";

/**
 * Shared print + foil DOM for identity and billing faces.
 *
 * Material paint lives on CSS variables set by `applyFoil` / `applyFrame` —
 * these nodes are only slots. Content sits above the foil so type is not eaten
 * by the laminate.
 *
 * React 19: `ref` is a normal prop (same pattern as the original HoloBody).
 */
export function HoloMembershipFace({
	ref,
	className,
	style,
	"aria-hidden": ariaHidden,
	children,
}: {
	ref?: Ref<HTMLDivElement>;
	className?: string;
	/** Merge over the default credit-card aspect — pass `aspectRatio: "auto"` when filling a stage. */
	style?: CSSProperties;
	/** Flip shell hides the away face from assistive tech. */
	"aria-hidden"?: boolean;
	children: ReactNode;
}) {
	return (
		<div
			ref={ref}
			className={cn("holo-card", className)}
			// Membership card proportion (~credit-card landscape); flip stage can override.
			style={{ aspectRatio: "1.586", ...style }}
			aria-hidden={ariaHidden}
		>
			{/* Fixed pale print — foil layers only catch light above it. */}
			<div className="holo-body" />
			{/* Tilt-budget decoration: dark + lit halves. */}
			<div className="holo-pattern" aria-hidden />
			<div className="holo-pattern--lit" aria-hidden />
			{/* Up to three generic foil layers (material data from applyFoil). */}
			<div className="holo-foil" aria-hidden />
			<div className="holo-foil--b" aria-hidden />
			<div className="holo-foil--c" aria-hidden />
			<div className="holo-smear" aria-hidden />
			<div className="holo-spot" aria-hidden />
			<div className="holo-noise" aria-hidden />
			<div className="holo-glare" aria-hidden />
			<div className="holo-sheen" aria-hidden />
			<div className="holo-content">{children}</div>
		</div>
	);
}

/** Duotone portrait tile — polarity sweep driven by `--tile-*` CSS vars. */
export function HoloMembershipTile() {
	return (
		<div className="holo-tile" aria-hidden>
			<div className="holo-tile__photo" />
			<div className="holo-tile__photo--neg" />
			<div className="holo-tile__duo" />
			<div className="holo-tile__gloss" />
		</div>
	);
}
