"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Pin, PinOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	MAX_PINNED_QUOTES,
	togglePinnedQuoteSaveId,
} from "@/lib/profile-pinned-quotes";
import { notifyQuotePinsChanged } from "@/lib/quote-pins-events";
import { SHEET_PRIMARY_PILL_CLASS } from "@/lib/sheet-chrome";

/** Owner-only control on `/quotes` rows — pin/unpin on profile (max 3). */
export function QuotePinToProfileButton({
	saveId,
	variant = "pill",
}: {
	saveId: string;
	variant?: "pill" | "compact";
}) {
	const router = useRouter();
	const [pinnedIds, setPinnedIds] = useState<string[]>([]);
	const [loadingPins, setLoadingPins] = useState(false);
	const [busy, setBusy] = useState(false);

	const isPinned = pinnedIds.includes(saveId);

	useEffect(() => {
		let cancelled = false;
		async function loadPins() {
			setLoadingPins(true);
			try {
				const res = await api.api.profiles.me.get();
				if (cancelled || res.error || !res.data) return;
				const raw = (res.data as { pinnedQuoteSaveIds?: unknown })
					.pinnedQuoteSaveIds;
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
	}, []);

	const handleTogglePin = useCallback(async () => {
		const next = togglePinnedQuoteSaveId(pinnedIds, saveId);
		if ("error" in next) {
			toast.error(
				`You can pin up to ${MAX_PINNED_QUOTES} quotes on your profile`,
			);
			return;
		}
		setBusy(true);
		try {
			const res = await api.api.profiles.me.pins.quotes.patch({
				quoteSaveIds: next,
			});
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Couldn't update pins";
				toast.error(message);
				return;
			}
			const saved =
				(res.data as { pinnedQuoteSaveIds?: string[] } | null)
					?.pinnedQuoteSaveIds ?? next;
			setPinnedIds(saved);
			toast.success(isPinned ? "Unpinned from profile" : "Pinned to profile");
			notifyQuotePinsChanged();
			router.refresh();
		} catch {
			toast.error("Couldn't update pins");
		} finally {
			setBusy(false);
		}
	}, [isPinned, pinnedIds, router, saveId]);

	const pinLabel = isPinned ? "Unpin from profile" : "Pin to profile";

	if (variant === "compact") {
		return (
			<DetailMotionButtonWrap>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className={cn(
						"h-8 rounded-full px-3 text-xs",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					disabled={busy || loadingPins}
					onClick={() => void handleTogglePin()}
				>
					{isPinned ? (
						<PinOff className="size-3.5" aria-hidden />
					) : (
						<Pin className="size-3.5" aria-hidden />
					)}
					{isPinned ? "Pinned" : "Pin to profile"}
				</Button>
			</DetailMotionButtonWrap>
		);
	}

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
				{pinLabel}
			</Button>
		</DetailMotionButtonWrap>
	);
}
