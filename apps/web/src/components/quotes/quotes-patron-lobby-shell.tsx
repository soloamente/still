"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { QuotesKindChips } from "@/components/quotes/quotes-kind-chips";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/** Client `/quotes` chrome — media filter chips + saved list body. */
export function QuotesPatronLobbyShell({ children }: { children: ReactNode }) {
	return (
		<LobbyNavigationProvider>
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				<div className="mb-6 flex shrink-0 justify-center">
					<QuotesKindChips />
				</div>
				{children}
			</section>
		</LobbyNavigationProvider>
	);
}
