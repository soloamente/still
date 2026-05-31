"use client";

import { Button } from "@still/ui/components/button";
import { Pin, PinOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
	MAX_PINNED_REVIEWS,
	togglePinnedReviewId,
} from "@/lib/profile-pinned-reviews";
import { SHEET_PRIMARY_PILL_CLASS } from "@/lib/sheet-chrome";

/**
 * Owner-only control in the review reader — pin/unpin on profile (max 3).
 */
export function ReviewPinToProfileButton({
	reviewId,
	reviewUserId,
}: {
	reviewId: string;
	reviewUserId: string;
}) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const [pinnedIds, setPinnedIds] = useState<string[]>([]);
	const [loadingPins, setLoadingPins] = useState(false);
	const [busy, setBusy] = useState(false);

	const isOwner = Boolean(
		session?.user?.id && session.user.id === reviewUserId,
	);
	const isPinned = pinnedIds.includes(reviewId);

	useEffect(() => {
		if (!isOwner) return;
		let cancelled = false;
		async function loadPins() {
			setLoadingPins(true);
			try {
				const res = await api.api.profiles.me.get();
				if (cancelled || res.error || !res.data) return;
				const raw = (res.data as { pinnedReviewIds?: unknown }).pinnedReviewIds;
				setPinnedIds(
					Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [],
				);
			} finally {
				if (!cancelled) setLoadingPins(false);
			}
		}
		void loadPins();
		return () => {
			cancelled = true;
		};
	}, [isOwner]);

	const handleTogglePin = useCallback(async () => {
		const next = togglePinnedReviewId(pinnedIds, reviewId);
		if ("error" in next) {
			toast.error(`You can pin up to ${MAX_PINNED_REVIEWS} reviews`);
			return;
		}
		setBusy(true);
		try {
			const res = await api.api.profiles.me.pins.patch({ reviewIds: next });
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Couldn't update pins";
				toast.error(message);
				return;
			}
			const saved =
				(res.data as { pinnedReviewIds?: string[] } | null)?.pinnedReviewIds ??
				next;
			setPinnedIds(saved);
			toast.success(isPinned ? "Unpinned from profile" : "Pinned to profile");
			router.refresh();
		} catch {
			toast.error("Couldn't update pins");
		} finally {
			setBusy(false);
		}
	}, [isPinned, pinnedIds, reviewId, router]);

	if (!isOwner) return null;

	return (
		<DetailMotionButtonWrap>
			<Button
				type="button"
				variant="secondary"
				size="pill"
				className={SHEET_PRIMARY_PILL_CLASS}
				disabled={busy || loadingPins}
				onClick={() => void handleTogglePin()}
			>
				{isPinned ? (
					<PinOff className="size-4" aria-hidden />
				) : (
					<Pin className="size-4" aria-hidden />
				)}
				{isPinned ? "Unpin from profile" : "Pin to profile"}
			</Button>
		</DetailMotionButtonWrap>
	);
}
