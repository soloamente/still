"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { cn } from "@still/ui/lib/utils";
import { TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useState } from "react";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/**
 * Centered destructive confirmation with a type-to-confirm gate — shared by
 * Clear library data and Delete account (Data settings danger zone).
 */
export function MeDestructiveConfirmDialog({
	open,
	title,
	confirmPhrase,
	confirmLabel,
	busyLabel,
	isBusy,
	error,
	onClose,
	onConfirm,
	children,
}: {
	open: boolean;
	title: string;
	/** Exact phrase the patron must type, e.g. "clear my library". */
	confirmPhrase: string;
	confirmLabel: string;
	busyLabel: string;
	isBusy: boolean;
	error: string | null;
	onClose: () => void;
	onConfirm: () => void;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const inputId = useId();
	const [typed, setTyped] = useState("");
	const confirmed = typed.trim().toLowerCase() === confirmPhrase;

	useEffect(() => {
		if (!open) setTyped("");
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	const handleKey = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape" && !isBusy) onClose();
		},
		[onClose, isBusy],
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

	return (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center overflow-y-auto overscroll-contain px-4 py-8",
					)}
					onClick={() => {
						if (!isBusy) onClose();
					}}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={panelTransition}
						onClick={(e) => e.stopPropagation()}
						className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onClose}
								disabled={isBusy}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex flex-col items-center px-7 pt-10 pb-8 text-center sm:px-9 sm:pt-12 sm:pb-10">
							<div
								className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-destructive sm:size-16"
								aria-hidden
							>
								<TriangleAlert
									className="size-7 sm:size-8"
									strokeWidth={1.75}
									aria-hidden
								/>
							</div>

							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								{title}
							</h2>

							<div className="mt-4 w-full text-left text-muted-foreground text-sm leading-relaxed">
								{children}
							</div>

							<form
								className="mt-6 w-full"
								onSubmit={(e) => {
									e.preventDefault();
									if (confirmed && !isBusy) onConfirm();
								}}
							>
								<label
									htmlFor={inputId}
									className="block text-left text-muted-foreground text-sm"
								>
									Type{" "}
									<span className="font-semibold text-foreground">
										{confirmPhrase}
									</span>{" "}
									to confirm
								</label>
								<Input
									id={inputId}
									value={typed}
									onChange={(e) => setTyped(e.target.value)}
									autoComplete="off"
									spellCheck={false}
									disabled={isBusy}
									className="mt-2 bg-background"
								/>

								{error ? (
									<p className="mt-3 text-left text-destructive text-sm">
										{error}
									</p>
								) : null}

								<div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
									<DetailMotionButtonWrap>
										<Button
											type="button"
											variant="ghost"
											size="pill"
											disabled={isBusy}
											className={cn(
												"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-muted-foreground sm:w-auto sm:min-w-34",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
											onClick={onClose}
										>
											Cancel
										</Button>
									</DetailMotionButtonWrap>
									<DetailMotionButtonWrap>
										<Button
											type="submit"
											variant="destructive"
											size="pill"
											disabled={!confirmed || isBusy}
											className="h-auto min-h-11 w-full px-5 py-2.5 text-base sm:w-auto sm:min-w-34"
										>
											{isBusy ? busyLabel : confirmLabel}
										</Button>
									</DetailMotionButtonWrap>
								</div>
							</form>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
