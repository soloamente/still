"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { MeAccountBarActionsProvider } from "@/components/profile/me-account-bar-actions-context";
import { MeAccountNav } from "@/components/profile/me-account-nav";
import { MeAccountRouteTransition } from "@/components/profile/me-account-route-transition";
import { MeAccountSessionProvider } from "@/components/profile/me-account-session-context";
import { MeAccountTopBar } from "@/components/profile/me-account-top-bar";
import { PROFILE_LOBBY_BODY_GUTTER_CLASSNAME } from "@/components/profile/profile-patron-header";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/** Account settings / customize — profile lobby shell with sidebar nav on large screens. */
export function MeAccountShell({
	handle,
	children,
}: {
	handle: string;
	children: ReactNode;
}) {
	return (
		<MeAccountSessionProvider>
			<MeAccountBarActionsProvider>
				<div className="flex flex-1 flex-col bg-background">
					<MeAccountTopBar handle={handle} />
					<section
						className={cn(
							HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
							"min-h-0 flex-1 gap-0 p-0",
						)}
					>
						<div
							className={cn(
								"grid min-h-0 w-full flex-1 gap-8 pt-5 pb-10 lg:grid-cols-[minmax(0,13.75rem)_minmax(0,1fr)] lg:gap-12 lg:pb-12",
								PROFILE_LOBBY_BODY_GUTTER_CLASSNAME,
							)}
						>
							{/*
							 * Sticky below `MeAccountTopBar` + its scroll scrim. `z-[31]` keeps the
							 * rail above the header shadow (`MeAccountTopBar` is `z-30`).
							 */}
							<aside className="sticky top-[5.5rem] z-[31] min-w-0 self-start">
								<MeAccountNav handle={handle} />
							</aside>
							<div className="w-full min-w-0 pt-2">
								<MeAccountRouteTransition>{children}</MeAccountRouteTransition>
							</div>
						</div>
					</section>
				</div>
			</MeAccountBarActionsProvider>
		</MeAccountSessionProvider>
	);
}
