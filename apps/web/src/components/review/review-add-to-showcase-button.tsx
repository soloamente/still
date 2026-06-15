"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	appendShowcaseItem,
	isShowcaseItemPresent,
	MAX_SHOWCASE_ITEMS,
	parseShowcaseItemsFromProfile,
	type ShowcaseItem,
	showcaseFilledCount,
} from "@/lib/profile-showcase";

/**
 * Owner-only control in the review reader — add this review to profile Showcase.
 */
export function ReviewAddToShowcaseButton({
	reviewId,
	reviewUserId,
	iconButtonClassName,
}: {
	reviewId: string;
	reviewUserId: string;
	iconButtonClassName?: string;
}) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
	const [loadingShowcase, setLoadingShowcase] = useState(false);
	const [busy, setBusy] = useState(false);

	const isOwner = Boolean(
		session?.user?.id && session.user.id === reviewUserId,
	);
	const reviewItem = { kind: "review" as const, id: reviewId };
	const inShowcase = isShowcaseItemPresent(showcaseItems, reviewItem);
	const slotsFull = showcaseFilledCount(showcaseItems) >= MAX_SHOWCASE_ITEMS;

	useEffect(() => {
		if (!isOwner) return;
		let cancelled = false;
		async function loadShowcase() {
			setLoadingShowcase(true);
			try {
				const res = await api.api.profiles.me.get();
				if (cancelled || res.error || !res.data) return;
				const raw = (res.data as { showcaseItems?: unknown }).showcaseItems;
				setShowcaseItems(parseShowcaseItemsFromProfile(raw));
			} finally {
				if (!cancelled) setLoadingShowcase(false);
			}
		}
		void loadShowcase();
		return () => {
			cancelled = true;
		};
	}, [isOwner]);

	const handleAddToShowcase = useCallback(async () => {
		const item = { kind: "review" as const, id: reviewId };
		const next = appendShowcaseItem(showcaseItems, item);
		if ("error" in next) {
			toast.error(next.error);
			return;
		}
		setBusy(true);
		try {
			const res = await api.api.profiles.me.showcase.patch({ items: next });
			if (res.error) {
				const message =
					typeof (res.error as { value?: { error?: string } }).value?.error ===
					"string"
						? (res.error as { value: { error: string } }).value.error
						: "Couldn't update showcase";
				toast.error(message);
				return;
			}
			const saved = parseShowcaseItemsFromProfile(
				(res.data as { showcaseItems?: unknown } | null)?.showcaseItems,
			);
			setShowcaseItems(saved.length > 0 ? saved : next);
			toast.success("Added to showcase");
			router.refresh();
		} catch {
			toast.error("Couldn't update showcase");
		} finally {
			setBusy(false);
		}
	}, [reviewId, router, showcaseItems]);

	if (!isOwner) return null;

	// Hide when all slots are taken by other titles and this review is not showcased.
	if (slotsFull && !inShowcase) return null;

	const label = inShowcase ? "In showcase" : "Add to showcase";

	return (
		<DetailMotionButtonWrap>
			<DetailIconTooltip label={label}>
				<Button
					type="button"
					variant="ghost"
					size="icon-pill"
					className={cn(
						iconButtonClassName ??
							"size-10 rounded-[var(--radius-pill)] bg-background text-muted-foreground",
						!iconButtonClassName && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						inShowcase && "text-foreground",
					)}
					disabled={busy || loadingShowcase || inShowcase}
					aria-label={label}
					onClick={() => void handleAddToShowcase()}
				>
					<LayoutGrid className="size-5" aria-hidden />
				</Button>
			</DetailIconTooltip>
		</DetailMotionButtonWrap>
	);
}
