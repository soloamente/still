"use client";

import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import { PlanFeatureGate } from "@/components/plans/plan-feature-gate";
import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";
import { PROFILE_HEADER_PILL_PRESS_CLASS } from "@/components/profile/profile-stat-cell";
import { TasteOverlapDialog } from "@/components/profile/taste-overlap-dialog";
import { api } from "@/lib/api";
import { DETAIL_MOTION_PRESSABLE_CLASS } from "@/lib/detail-action-motion";
import { profileTasteCompareFromSearch } from "@/lib/notification-href";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";

/** Secondary pill on `bg-card` — matches profile stat pills under the banner. */
const secondaryPill = cn(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-background px-5 py-3 font-semibold text-foreground text-sm sm:text-base",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
	PROFILE_HEADER_PILL_PRESS_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/** Primary pill — same inverted treatment as movie detail “Add to Watched”. */
const primaryPill = cn(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 font-semibold text-background text-sm sm:text-base",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/** Profile header CTAs — movie detail pill styling (no shadows, flat surfaces). */
export function ProfilePatronActions({
	isMe,
	targetUserId,
	handle,
	canCompareTaste,
	initialTasteCompareOpen = false,
}: {
	isMe: boolean;
	targetUserId: string;
	handle: string;
	/** Signed-in viewer viewing someone else's profile. */
	canCompareTaste?: boolean;
	/** Deep link from taste challenge notification (`?tasteCompare=1`). */
	initialTasteCompareOpen?: boolean;
}) {
	if (isMe) {
		return (
			<div className="mt-4 flex flex-wrap justify-center gap-2">
				<DetailMotionButton
					type="button"
					className={secondaryPill}
					onClick={async () => {
						const url = `${window.location.origin}/og/taste/${encodeURIComponent(handle)}`;
						try {
							await navigator.clipboard.writeText(url);
							trackSenseProductEvent("taste_card.shared", { handle });
							toast.success("Taste card link copied");
						} catch {
							toast.error("Could not copy link");
						}
					}}
				>
					Share taste card
				</DetailMotionButton>
				<DetailMotionLink href="/me/settings/profile" className={primaryPill}>
					Edit profile
				</DetailMotionLink>
			</div>
		);
	}

	return (
		<ProfileOtherPatronActions
			targetUserId={targetUserId}
			handle={handle}
			canCompareTaste={canCompareTaste}
			initialTasteCompareOpen={initialTasteCompareOpen}
		/>
	);
}

function ProfileOtherPatronActions({
	targetUserId,
	handle,
	canCompareTaste,
	initialTasteCompareOpen,
}: {
	targetUserId: string;
	handle: string;
	canCompareTaste?: boolean;
	initialTasteCompareOpen?: boolean;
}) {
	const [compareOpen, setCompareOpen] = useState(
		Boolean(initialTasteCompareOpen),
	);
	const { hasFeature } = usePatronEntitlements();
	const canUseTasteOverlap = Boolean(
		canCompareTaste && hasFeature("taste_overlap"),
	);

	useEffect(() => {
		if (!canUseTasteOverlap) return;
		if (initialTasteCompareOpen) {
			setCompareOpen(true);
			return;
		}
		// Client navigation (e.g. notification bell) may not remount the server page.
		if (profileTasteCompareFromSearch(window.location.search)) {
			setCompareOpen(true);
			const url = new URL(window.location.href);
			url.searchParams.delete("tasteCompare");
			const next =
				url.pathname +
				(url.searchParams.toString() ? `?${url.searchParams}` : "");
			window.history.replaceState({}, "", next);
		}
	}, [canUseTasteOverlap, initialTasteCompareOpen]);

	return (
		<>
			<div className="mt-4 flex flex-wrap justify-center gap-2">
				<ProfileFollowAction targetUserId={targetUserId} />
				{canCompareTaste ? (
					canUseTasteOverlap ? (
						<DetailMotionButton
							type="button"
							className={secondaryPill}
							onClick={() => setCompareOpen(true)}
						>
							Compare taste
						</DetailMotionButton>
					) : (
						<div className="max-w-xs">
							<PlanFeatureGate featureKey="taste_overlap">
								<span className="sr-only">Compare taste</span>
							</PlanFeatureGate>
						</div>
					)
				) : null}
			</div>
			{canUseTasteOverlap ? (
				<TasteOverlapDialog
					open={compareOpen}
					onOpenChange={setCompareOpen}
					targetHandle={handle}
				/>
			) : null}
		</>
	);
}

function ProfileFollowAction({ targetUserId }: { targetUserId: string }) {
	const router = useRouter();
	const [following, setFollowing] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		api.api.follows
			.check({ userId: targetUserId })
			.get()
			.then((res) => {
				if (cancelled) return;
				const data = res.data as { following?: boolean } | null;
				setFollowing(Boolean(data?.following));
			})
			.catch(() => {
				if (!cancelled) setFollowing(false);
			});
		return () => {
			cancelled = true;
		};
	}, [targetUserId]);

	async function toggle() {
		setBusy(true);
		try {
			if (following) {
				await api.api.follows({ userId: targetUserId }).delete();
				setFollowing(false);
				toast.success("Unfollowed");
			} else {
				await api.api.follows({ userId: targetUserId }).post();
				setFollowing(true);
				toast.success("Following");
			}
			// Reconcile the SSR'd follower count (and any other server-derived
			// stats) so the number reflects the toggle instead of going stale.
			router.refresh();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update");
		} finally {
			setBusy(false);
		}
	}

	if (following === null) {
		return (
			<DetailMotionButton
				type="button"
				disabled
				className={cn(secondaryPill, "opacity-60")}
			>
				Loading
			</DetailMotionButton>
		);
	}

	return (
		<DetailMotionButton
			type="button"
			disabled={busy}
			onClick={toggle}
			className={following ? secondaryPill : primaryPill}
		>
			{following ? "Following" : "Follow"}
		</DetailMotionButton>
	);
}
