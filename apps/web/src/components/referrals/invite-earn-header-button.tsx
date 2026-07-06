"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Gift } from "lucide-react";

import { openInviteEarnDialog } from "@/components/referrals/invite-earn-dialog-root";
import { DETAIL_MOTION_PRESSABLE_CLASS } from "@/lib/detail-action-motion";

/** Signed-in header pill — opens the global Invite & earn dialog. */
export function InviteEarnHeaderButton() {
	return (
		<Button
			type="button"
			variant="ghost"
			onClick={openInviteEarnDialog}
			className={cn(
				"h-9 shrink-0 rounded-full bg-card px-3 font-medium text-foreground text-xs sm:h-10 sm:px-3.5 sm:text-sm",
				"[@media(hover:hover)]:hover:bg-card/80",
				DETAIL_MOTION_PRESSABLE_CLASS,
			)}
		>
			<Gift className="size-4 shrink-0 sm:hidden" aria-hidden />
			<span className="hidden sm:inline">Invite & earn</span>
			<span className="sr-only sm:hidden">Invite and earn</span>
		</Button>
	);
}
