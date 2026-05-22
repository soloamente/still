"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/** Centered on viewport — above radial (`z-[200]`) and poster hover stacks. */
const DELETE_CONFIRM_OVERLAY_CLASS =
	"fixed inset-0 z-[250] grid min-h-[100dvh] place-items-center overflow-y-auto overscroll-contain bg-absolute-black/78 px-4 py-8 backdrop-blur-sm";

/**
 * Delete-list confirmation — same shell as {@link MeAccountLeaveConfirmDialog}
 * on settings (icon in soft circle, stacked copy, pill actions).
 */
export function ListLobbyDeleteConfirmDialog({
	open,
	listTitle,
	deleting = false,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	listTitle: string;
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

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
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

	const portal = (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={DELETE_CONFIRM_OVERLAY_CLASS}
					onClick={deleting ? undefined : onCancel}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={panelTransition}
						onClick={(event) => event.stopPropagation()}
						className={cn(
							"relative flex min-h-[22rem] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:min-h-[24rem] sm:rounded-[2.25rem]",
						)}
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onCancel}
								disabled={deleting}
								aria-label="Cancel and keep this list"
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
								Delete this list?
							</h2>
							<p
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose text-balance text-muted-foreground text-sm leading-tight sm:text-base"
							>
								<span className="font-medium text-foreground">{listTitle}</span>{" "}
								and everything in it will be removed permanently.
								<br />
								This cannot be undone.
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
										Delete list
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
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
