"use client";

import { Button } from "@still/ui/components/button";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { MembersLeaderboardSort } from "@/lib/members-leaderboard-types";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";

/**
 * Follow control on Community Ranks patron rows — seeds from API `viewerFollows` and records
 * `members.followed` when the patron follows from the leaderboard.
 */
export function MembersFollowButton({
	targetUserId,
	initialFollowing,
	sort,
	period,
}: {
	targetUserId: string;
	initialFollowing: boolean;
	sort: MembersLeaderboardSort;
	period: string;
}) {
	const [following, setFollowing] = useState(initialFollowing);
	const [busy, setBusy] = useState(false);

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
				trackSenseProductEvent("members.followed", {
					targetUserId,
					sort,
					period,
				});
			}
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Button
			variant={following ? "ghost-light" : "accent"}
			size="pill"
			onClick={toggle}
			disabled={busy}
			className="shrink-0"
		>
			{busy ? (
				<Loader2 className="size-3.5 animate-spin" />
			) : following ? (
				<UserCheck className="size-3.5" />
			) : (
				<UserPlus className="size-3.5" />
			)}
			{following ? "Following" : "Follow"}
		</Button>
	);
}
