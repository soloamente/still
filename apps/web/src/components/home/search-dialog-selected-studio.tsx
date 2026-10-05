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
			role="img"
			aria-label={name}
			className={`flex items-center justify-center overflow-hidden p-1.5 ${SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS}`}
		>
			<SearchDialogStudioLogo
				studioId={studioId}
				studioName={name}
				fallbackLogoUrl={logoUrl}
				variant="rail"
				className="size-full min-h-0 min-w-0"
			/>
		</div>
	);
}
