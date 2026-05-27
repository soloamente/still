"use client";

import { LobbyOrderChipFallback } from "@/components/app/lobby-suspense-fallbacks";
import { ProfileCatalogOrderChips } from "@/components/profile/profile-catalog-order-chips";
import { ProfileCatalogVenueChips } from "@/components/profile/profile-catalog-venue-chips";
import { useProfileLobbyParams } from "@/components/profile/profile-lobby-params-context";
import {
	type ProfileSocialTabId,
	ProfileTabToolbar,
} from "@/components/profile/profile-tab-toolbar";

/**
 * Profile lobby controls — order (left), section tabs (center), venue (right).
 * Reads active tab / ledger from `ProfileLobbyParamsProvider` for instant chip state.
 */
export function ProfileLobbyChrome({
	socialTabs,
}: {
	socialTabs: readonly ProfileSocialTabId[];
}) {
	const { toolbarActiveTab, ledgerTab } = useProfileLobbyParams();
	const showLedgerRails =
		ledgerTab === "movies" ||
		ledgerTab === "tv" ||
		toolbarActiveTab === "favorites";
	const chipFallback = <LobbyOrderChipFallback />;

	return (
		<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
			<div className="flex min-w-0 justify-start">
				{showLedgerRails ? (
					<ProfileCatalogOrderChips ledgerTab={ledgerTab} />
				) : (
					chipFallback
				)}
			</div>

			<div className="flex min-w-0 justify-center">
				<ProfileTabToolbar socialTabs={socialTabs} />
			</div>

			<div className="flex min-w-0 justify-end">
				{showLedgerRails ? (
					<ProfileCatalogVenueChips ledgerTab={ledgerTab} />
				) : null}
			</div>
		</div>
	);
}
