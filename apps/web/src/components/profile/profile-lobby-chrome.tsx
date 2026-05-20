"use client";

import { Suspense } from "react";

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
	socialTabs,
}: {
	handle: string;
	activeTab: ProfileTabId;
	socialTabs: readonly ProfileSocialTabId[];
}) {
	const showLedgerRails = activeTab === "movies" || activeTab === "tv";

	const ledgerTab = activeTab as ProfileLedgerTabId;
	const chipFallback = (
		<div
			className="h-10 w-40 animate-pulse rounded-full bg-background"
			aria-hidden
		/>
	);

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
				<Suspense
					fallback={
						<div
							className="h-10 w-48 shrink-0 animate-pulse rounded-full bg-background"
							aria-hidden
						/>
					}
				>
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
