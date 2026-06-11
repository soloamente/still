"use client";

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

	return (
		<div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
			{showLedgerRails ? (
				<div className="flex min-w-0 justify-center sm:justify-start">
					<ProfileCatalogOrderChips ledgerTab={ledgerTab} />
				</div>
			) : null}

			<div className="flex min-w-0 justify-center">
				<ProfileTabToolbar socialTabs={socialTabs} />
			</div>

			{showLedgerRails ? (
				<div className="flex min-w-0 justify-center sm:justify-end">
					<ProfileCatalogVenueChips ledgerTab={ledgerTab} />
				</div>
			) : null}
		</div>
	);
}
