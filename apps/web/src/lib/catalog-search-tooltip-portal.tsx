"use client";

import { TooltipContent, TooltipProvider } from "@still/ui/components/tooltip";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
} from "react";

/**
 * Tooltips default to `document.body` at z-60, which paints *under* a native
 * `<dialog open>` top layer. Mount tooltips into the dialog-owned layer instead.
 */
export const CATALOG_SEARCH_TOOLTIP_POSITIONER_CLASS = "z-20 outline-none";

/**
 * Shared Base UI delay group for ⌘K logo rails — first hover waits `delay`, then
 * hopping across adjacent logos opens the next tooltip immediately.
 */
export const SEARCH_DIALOG_RAIL_TOOLTIP_PROVIDER_PROPS = {
	delay: 280,
	closeDelay: 80,
} as const satisfies ComponentProps<typeof TooltipProvider>;

export function SearchDialogRailTooltipProvider({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<TooltipProvider {...SEARCH_DIALOG_RAIL_TOOLTIP_PROVIDER_PROPS}>
			{children}
		</TooltipProvider>
	);
}

const CatalogSearchTooltipPortalContext = createContext<HTMLElement | null>(
	null,
);

export function CatalogSearchTooltipPortalProvider({
	container,
	children,
}: {
	container: HTMLElement | null;
	children: ReactNode;
}) {
	return (
		<CatalogSearchTooltipPortalContext.Provider value={container}>
			{children}
		</CatalogSearchTooltipPortalContext.Provider>
	);
}

function useCatalogSearchTooltipPortal(): HTMLElement | null {
	return useContext(CatalogSearchTooltipPortalContext);
}

/** Tooltip body for studio / streaming rails inside ⌘K. */
export function CatalogSearchTooltipContent(
	props: ComponentProps<typeof TooltipContent>,
) {
	const portalContainer = useCatalogSearchTooltipPortal();
	return (
		<TooltipContent
			portalContainer={portalContainer}
			positionerClassName={
				portalContainer ? CATALOG_SEARCH_TOOLTIP_POSITIONER_CLASS : undefined
			}
			{...props}
		/>
	);
}
