"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { HomeLobbyTasteTrailerBackground } from "@/components/home/home-lobby-taste-trailer-background";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * Movies/TV/Community lobby card — hosts the taste-hero trailer on the outer
 * `bg-card` shell instead of the nested hero tile.
 */
export function HomeLobbyCatalogueSection({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<section
			className={cn(
				HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
				"relative overflow-visible",
			)}
		>
			<HomeLobbyTasteTrailerBackground />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5">
				{children}
			</div>
		</section>
	);
}
