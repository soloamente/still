"use client";

import type { PlanTierId } from "@still/plans";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PlanPurchaseSuccessDialog } from "@/components/app/plan-purchase-success-dialog";
import { usePatronEntitlementsOptional } from "@/components/plans/use-patron-entitlements";
import { fetchSyncPolarCheckoutClient } from "@/lib/fetch-sync-polar-checkout-client";
import {
	parsePlanPurchaseSuccessQuery,
	stripPlanPurchaseSuccessParams,
} from "@/lib/plan-purchase-success-query";

/** Opens thank-you dialog when Polar redirects to /home?checkout=success. */
export function PlanPurchaseSuccessDialogRoot() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const entitlements = usePatronEntitlementsOptional();
	const handledRef = useRef(false);

	const [open, setOpen] = useState(false);
	const [resolvedTier, setResolvedTier] = useState<Exclude<
		PlanTierId,
		"still"
	> | null>(null);
	const [pendingSync, setPendingSync] = useState(false);

	useEffect(() => {
		const query = parsePlanPurchaseSuccessQuery(
			searchParams?.toString() ? `?${searchParams.toString()}` : "",
		);
		if (!query.isSuccess) return;
		if (handledRef.current) return;
		handledRef.current = true;

		const checkoutId = query.checkoutId;
		let cancelled = false;

		async function finalize() {
			let tier: Exclude<PlanTierId, "still"> | null = null;
			let syncPending = false;

			if (checkoutId) {
				try {
					const result = await fetchSyncPolarCheckoutClient(checkoutId);
					if (cancelled) return;
					if (result.synced) {
						tier = result.tier;
						router.refresh();
					} else {
						syncPending = true;
					}
				} catch {
					if (cancelled) return;
					syncPending = true;
				}
			} else {
				syncPending = true;
			}

			if (
				!tier &&
				entitlements?.effectiveTier &&
				entitlements.effectiveTier !== "still"
			) {
				tier = entitlements.effectiveTier;
			}

			setResolvedTier(tier);
			setPendingSync(syncPending);
			setOpen(true);

			const cleared = stripPlanPurchaseSuccessParams(
				window.location.pathname,
				window.location.search,
			);
			router.replace(cleared, { scroll: false });
		}

		void finalize();

		return () => {
			cancelled = true;
		};
	}, [entitlements?.effectiveTier, router, searchParams]);

	const handleDismiss = () => {
		setOpen(false);
	};

	return (
		<PlanPurchaseSuccessDialog
			open={open}
			tier={resolvedTier}
			pendingSync={pendingSync}
			onDismiss={handleDismiss}
		/>
	);
}
