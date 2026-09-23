"use client";

import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
import { SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS } from "@/lib/search-dialog-studios";

/**
 * Selected-studio mark above typed results — raised tile on the nested body well.
 */
export function SearchDialogSelectedStudioTile({
	studioId,
	name,
	logoUrl,
}: {
	studioId: number;
	name: string;
	logoUrl: string | null;
}) {
	return (
		<div
			className={`overflow-hidden ${SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS}`}
			aria-label={name}
		>
			<SearchDialogStudioLogo
				studioId={studioId}
				fallbackLogoUrl={logoUrl}
				variant="rail"
			/>
		</div>
	);
}
