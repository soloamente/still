"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreateListDialog } from "@/components/list/create-list-dialog";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";

/** Primary CTA chrome — matches `CreateListDialog` footer “Create list” control. */
export const LISTS_NEW_LIST_BUTTON_CLASS =
	"hover:!bg-foreground hover:!text-background h-auto min-h-10 bg-foreground px-5 py-2.5 text-background text-sm [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background";

/**
 * Opens {@link CreateListDialog} with dialog spring press — same motion as hero/footer CTAs.
 */
export function ListsNewListButton({
	label = "New list",
	className,
}: {
	label?: string;
	className?: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	return (
		<>
			<DetailMotionButtonWrap>
				<Button
					type="button"
					variant="default"
					size="pill"
					className={cn(LISTS_NEW_LIST_BUTTON_CLASS, className)}
					onClick={() => setOpen(true)}
				>
					{label}
				</Button>
			</DetailMotionButtonWrap>
			<CreateListDialog
				open={open}
				onOpenChange={setOpen}
				onCreated={() => router.refresh()}
			/>
		</>
	);
}
