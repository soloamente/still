"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { QuotesLobbyFilterRow } from "@/components/quotes/quotes-lobby-filter-row";
import { useQuotesLobbyChipState } from "@/components/quotes/quotes-view-chips";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/** Client `/quotes` chrome — filter row + list body (no intro hero above chips). */
export function QuotesPatronLobbyShell({ children }: { children: ReactNode }) {
	const { view } = useQuotesLobbyChipState();
	const pageTitle = view === "submitted" ? "Submissions" : "Saved quotes";

	return (
		<LobbyNavigationProvider>
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				<header className="w-full shrink-0">
					{/* Visible title lives in document metadata + chips; keep one landmark h1. */}
					<h1 className="sr-only">{pageTitle}</h1>
					<QuotesLobbyFilterRow />
				</header>

				<div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>
			</section>
		</LobbyNavigationProvider>
	);
}
