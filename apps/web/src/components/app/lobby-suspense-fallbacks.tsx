"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

/** Sticky search chrome placeholder — shared across `/home`, diary, lists, watchlist. */
export function LobbyStickyChromeFallback() {
	return (
		<ShimmerBone
			className="sticky top-0 z-20 h-14 w-full rounded-[2rem] bg-card/60"
			aria-hidden
		/>
	);
}

/** Left catalogue sort / order chip rail. */
export function LobbyCatalogChipFallback() {
	return (
		<ShimmerBone className="h-10 w-44 rounded-full bg-background" aria-hidden />
	);
}

/** Right venue / view-mode chip rail. */
export function LobbyVenueChipFallback() {
	return (
		<ShimmerBone
			className="h-10 min-w-66 shrink-0 rounded-full bg-background"
			aria-hidden
		/>
	);
}

/** Centered tab toolbar (profile, achievements). */
export function LobbyCenterTabFallback({
	className = "h-10 w-48 shrink-0 rounded-full bg-background",
}: {
	className?: string;
}) {
	return <ShimmerBone className={className} aria-hidden />;
}

/** Profile / diary order chip (narrower left rail). */
export function LobbyOrderChipFallback() {
	return (
		<ShimmerBone className="h-10 w-40 rounded-full bg-background" aria-hidden />
	);
}
