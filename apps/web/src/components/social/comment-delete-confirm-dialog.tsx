"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import {
	DELETE_CONFIRM_BACKDROP_CLASS,
	DELETE_CONFIRM_OVERLAY_CLASS,
} from "@/components/social/delete-confirm-overlay-classes";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { healStuckVaulPointerEventsLock } from "@/lib/vaul-drawer-heal";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/** Confirms deleting a patron's own comment. */
export function CommentDeleteConfirmDialog({
	open,
	deleting = false,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	deleting?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Older confirms could leave Vaul layers at pointer-events:none while the drawer stays open.
	useEffect(() => {
		if (open) return;
		healStuckVaulPointerEventsLock();
	}, [open]);

	const handleKey = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape" && !deleting) onCancel();
		},
		[deleting, onCancel],
	);

	useEffect(() => {
		if (!open) return;
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [open, handleKey]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					key="comment-delete-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					className={DELETE_CONFIRM_OVERLAY_CLASS}
				>
					<div
						aria-hidden
						className={DELETE_CONFIRM_BACKDROP_CLASS}
						onClick={deleting ? undefined : onCancel}
					/>
					<motion.div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={panelTransition}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => event.stopPropagation()}
						className={cn(
							"pointer-events-auto relative z-10 flex min-h-[18rem] w-full max-w-sm touch-auto flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:min-h-[20rem] sm:rounded-[2.25rem]",
						)}
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onCancel}
								disabled={deleting}
								aria-label="Cancel delete"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex min-h-0 flex-1 flex-col items-center px-7 pt-10 pb-10 text-center sm:px-9 sm:pt-12 sm:pb-12">
							<div
								className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-destructive sm:mb-8 sm:size-16"
								aria-hidden
							>
								<TriangleAlert
									className="size-7 opacity-90 sm:size-8"
									strokeWidth={1.75}
									aria-hidden
								/>
							</div>

							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								Delete this comment?
							</h2>
							<p
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose text-balance text-muted-foreground text-sm leading-tight sm:text-base"
							>
								This removes your comment from the thread. Replies stay visible.
							</p>

							<div className="mt-auto flex w-full flex-col-reverse gap-2 pt-8 sm:flex-row sm:justify-center sm:gap-3 sm:pt-10">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										disabled={deleting}
										className={cn(
											"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-destructive sm:w-auto sm:min-w-34",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={onConfirm}
									>
										{deleting ? (
											<Loader2 className="size-3.5 animate-spin" aria-hidden />
										) : null}
										Delete
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										disabled={deleting}
										className="hover:!bg-foreground hover:!text-background h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background text-base sm:w-auto sm:min-w-34 [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
										onClick={onCancel}
									>
										Cancel
									</Button>
								</DetailMotionButtonWrap>
							</div>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}
