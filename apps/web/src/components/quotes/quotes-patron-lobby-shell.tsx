"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { QuotesLobbyFilterRow } from "@/components/quotes/quotes-lobby-filter-row";
import { QuotesLobbyPageHeader } from "@/components/quotes/quotes-lobby-page-header";
import { useQuotesLobbyChipState } from "@/components/quotes/quotes-view-chips";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * `/quotes` body under `HomeStickyChrome`.
 * Figma 4523:323 keeps the site header, then one rounded panel with the
 * page title and the quote grid.
 */
export function QuotesPatronLobbyShell({ children }: { children: ReactNode }) {
	const { view } = useQuotesLobbyChipState();

	return (
		<LobbyNavigationProvider>
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"mt-2 gap-8 overflow-visible px-5 pt-14 pb-10 sm:px-6 sm:pt-[4.5rem] sm:pb-12",
				)}
			>
				<QuotesLobbyPageHeader view={view} />
				<header className="w-full shrink-0">
					<QuotesLobbyFilterRow />
				</header>
				<div className="flex min-h-0 flex-1 flex-col">{children}</div>
			</section>
		</LobbyNavigationProvider>
	);
}
