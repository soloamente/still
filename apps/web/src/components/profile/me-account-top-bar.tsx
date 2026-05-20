"use client";

import IconShareIn from "@still/ui/icons/share-in";
import { cn } from "@still/ui/lib/utils";
import { type MouseEvent, useCallback } from "react";

import { DetailMotionLink } from "@/components/movie/detail-motion-pressable";
import { useMeAccountBarActions } from "@/components/profile/me-account-bar-actions-context";
import { useMeAccountSession } from "@/components/profile/me-account-session-context";
import { MeSaveButton } from "@/components/profile/me-save-button";
import { MeSecondaryButton } from "@/components/profile/me-secondary-button";

/** Sticky account chrome — back to profile on the left; Save / Cancel from the active `/me` page on the right. */
export function MeAccountTopBar({ handle }: { handle: string }) {
	const { actions } = useMeAccountBarActions();
	const { requestLeaveTo, anyUnsaved } = useMeAccountSession();
	const profileHref = `/profile/${encodeURIComponent(handle)}`;

	const handleProfileNavClick = useCallback(
		(e: MouseEvent<HTMLAnchorElement>) => {
			if (!anyUnsaved()) return;
			e.preventDefault();
			requestLeaveTo(profileHref);
		},
		[anyUnsaved, profileHref, requestLeaveTo],
	);

	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	);

	return (
		<header className="sticky top-0 z-30 w-full overflow-visible bg-background">
			<div className="flex w-full items-center justify-between gap-3 px-2.5 py-2 sm:px-3">
				<div className="flex min-w-0 justify-start">
					<DetailMotionLink
						href={`/profile/${encodeURIComponent(handle)}`}
						className={cn(pill, "max-w-full pl-3")}
						onClick={handleProfileNavClick}
					>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						<span className="truncate">Profile</span>
					</DetailMotionLink>
				</div>
				{actions ? (
					<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
						<MeSecondaryButton
							type="button"
							size="compact"
							onClick={actions.onCancel}
							disabled={actions.saving || !actions.canSave}
							aria-label="Discard unsaved changes"
						>
							Cancel
						</MeSecondaryButton>
						<MeSaveButton
							type="button"
							size="compact"
							onClick={() => void actions.onSave()}
							loading={Boolean(actions.saving)}
							disabled={actions.saving || !actions.canSave}
						>
							Save
						</MeSaveButton>
					</div>
				) : null}
			</div>
		</header>
	);
}
