"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * Movies/TV/Community lobby card — taste-hero media renders inside `HomeTasteMatchedHero`.
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
				"relative overflow-hidden",
			)}
		>
			<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5">
				{children}
			</div>
		</section>
	);
}
