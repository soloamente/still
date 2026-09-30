"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { openGuestAccountDialog } from "@/components/auth/guest-account-dialog";
import { CreateListDialog } from "@/components/list/create-list-dialog";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { authClient } from "@/lib/auth-client";
import { requestCreateList } from "@/lib/open-create-list-surface";

/** Primary CTA chrome — matches create-list footer “Create list” control. */
export const LISTS_NEW_LIST_BUTTON_CLASS =
	"hover:!bg-foreground hover:!text-background h-auto min-h-11 bg-foreground px-5 py-2.5 text-background text-sm [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background";

/**
 * Opens create-list — Vaul drawer on mobile (global root in `AppShell`), centered dialog on desktop.
 * Guests get the account dialog instead of the create surface.
 */
export function ListsNewListButton({
	label = "New list",
	mobileIconOnly = label === "New list",
	className,
}: {
	label?: string;
	/** Toolbar chip — plus only below `sm`; empty-state CTAs keep full label. */
	mobileIconOnly?: boolean;
	className?: string;
}) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session?.user);
	const [desktopOpen, setDesktopOpen] = useState(false);

	function handleOpen() {
		if (!signedIn) {
			openGuestAccountDialog();
			return;
		}
		requestCreateList({ onCreated: () => router.refresh() }, () =>
			setDesktopOpen(true),
		);
	}

	return (
		<>
			<DetailMotionButtonWrap>
				<Button
					type="button"
					variant="default"
					size="pill"
					aria-label={label}
					className={cn(
						LISTS_NEW_LIST_BUTTON_CLASS,
						mobileIconOnly &&
							"size-11 shrink-0 p-0 sm:size-auto sm:min-h-11 sm:px-5 sm:py-2.5",
						className,
					)}
					onClick={handleOpen}
				>
					{mobileIconOnly ? (
						<>
							<Plus className="size-5 sm:hidden" aria-hidden />
							<span className="hidden sm:inline">{label}</span>
						</>
					) : (
						label
					)}
				</Button>
			</DetailMotionButtonWrap>
			{signedIn ? (
				<CreateListDialog
					open={desktopOpen}
					onOpenChange={setDesktopOpen}
					onCreated={() => router.refresh()}
				/>
			) : null}
		</>
	);
}
