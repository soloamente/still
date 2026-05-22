"use client";

import { Suspense } from "react";

import {
	LobbyCenterTabFallback,
	LobbyOrderChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { ProfileCatalogOrderChips } from "@/components/profile/profile-catalog-order-chips";
import { ProfileCatalogVenueChips } from "@/components/profile/profile-catalog-venue-chips";
import {
	type ProfileSocialTabId,
	type ProfileTabId,
	ProfileTabToolbar,
} from "@/components/profile/profile-tab-toolbar";
import type { ProfileLedgerTabId } from "@/lib/profile-lobby-order";

/**
 * Profile lobby controls — order (left), section tabs (center), venue (right).
 * Mirrors `/diary` (order + In cinemas / At home) with tabs centered like film detail chrome.
 */
export function ProfileLobbyChrome({
	handle,
	activeTab,
	ledgerTab,
	socialTabs,
}: {
	handle: string;
	/** Highlighted center pill (Favorites when `?favorites=1`). */
	activeTab: ProfileTabId;
	/** Movies / TV ledger slice — order + venue rails follow this, not the pill label. */
	ledgerTab: ProfileLedgerTabId;
	socialTabs: readonly ProfileSocialTabId[];
}) {
	const showLedgerRails =
		ledgerTab === "movies" || ledgerTab === "tv" || activeTab === "favorites";
	const chipFallback = <LobbyOrderChipFallback />;

	return (
		<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
			<div className="flex min-w-0 justify-start">
				{showLedgerRails ? (
					<Suspense fallback={chipFallback}>
						<ProfileCatalogOrderChips handle={handle} ledgerTab={ledgerTab} />
					</Suspense>
				) : null}
			</div>

			<div className="flex min-w-0 justify-center">
				<Suspense fallback={<LobbyCenterTabFallback />}>
					<ProfileTabToolbar
						handle={handle}
						socialTabs={socialTabs}
						activeTab={activeTab}
					/>
				</Suspense>
			</div>

			<div className="flex min-w-0 justify-end">
				{showLedgerRails ? (
					<Suspense fallback={chipFallback}>
						<ProfileCatalogVenueChips handle={handle} ledgerTab={ledgerTab} />
					</Suspense>
				) : null}
			</div>
		</div>
	);
}
