"use client";

import { useProfileLobbyParams } from "@/components/profile/profile-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { ProfileLedgerTabId } from "@/lib/profile-lobby-order";

/**
 * Watch-venue rail on profile Movies / TV — liquid-gooey Move pill (diary parity).
 */
export function ProfileCatalogVenueChips({
	ledgerTab: _ledgerTab,
}: {
	ledgerTab: ProfileLedgerTabId;
}) {
	const { venue, selectVenue } = useProfileLobbyParams();

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id="profile-catalog-venue-desc" className="sr-only">
				Filter this patron&apos;s logged titles by whether they watched in
				theaters or at home.
			</p>
			<SegmentedPillToolbar
				layoutId="profile-catalog-venue-pill"
				aria-label="Watch venue"
				value={venue}
				onChange={selectVenue}
				options={[
					{
						id: "theaters",
						label: "In theaters",
						title: "Screenings logged as watched in theaters",
					},
					{
						id: "streaming",
						label: "At home",
						title: "Screenings logged as watched at home",
					},
				]}
				compact
				className="max-w-full flex-nowrap justify-start"
			/>
		</div>
	);
}
