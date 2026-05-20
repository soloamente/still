"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";

/** Secondary pill on `bg-card` — matches movie detail watchlist / circle controls. */
const secondaryPill = cn(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-background px-5 py-3 font-semibold text-foreground text-sm sm:text-base",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
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
}: {
	isMe: boolean;
	targetUserId: string;
}) {
	if (isMe) {
		return (
			<div className="mt-6 flex flex-wrap justify-center gap-2">
				<DetailMotionLink href="/me/customization" className={secondaryPill}>
					Customize
				</DetailMotionLink>
				<DetailMotionLink href="/me/settings" className={primaryPill}>
					Edit profile
				</DetailMotionLink>
			</div>
		);
	}

	return (
		<div className="mt-6 flex flex-wrap justify-center gap-2">
			<ProfileFollowAction targetUserId={targetUserId} />
		</div>
	);
}

function ProfileFollowAction({ targetUserId }: { targetUserId: string }) {
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
				<Loader2 className="size-3.5 animate-spin" /> Loading
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
			{busy ? (
				<Loader2 className="size-3.5 animate-spin" />
			) : following ? (
				<UserCheck className="size-3.5" />
			) : (
				<UserPlus className="size-3.5" />
			)}
			{following ? "Following" : "Follow"}
		</DetailMotionButton>
	);
}
