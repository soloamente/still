"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;
const FORM_ID = "me-destructive-confirm-form";

/** `bg-background` field on `bg-card` modal — same as edit-list / adult-content dialogs. */
const CONFIRM_FIELD_CLASS =
	"min-h-11 rounded-2xl border-transparent bg-background text-center text-base shadow-none outline-none focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

/** Centered on viewport — matches list delete / account-leave confirm shells. */
const DESTRUCTIVE_CONFIRM_OVERLAY_CLASS =
	"fixed inset-0 z-[250] grid min-h-[100dvh] place-items-center overflow-y-auto overscroll-contain bg-absolute-black/78 px-4 py-8 backdrop-blur-sm";

/**
 * Centered destructive confirmation with a type-to-confirm gate — shared by
 * Clear library data and Delete account (Data settings danger zone).
 * Shell parity: {@link ListLobbyDeleteConfirmDialog}, {@link MeAccountLeaveConfirmDialog}.
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
	const descriptionId = useId();
	const inputId = useId();
	const [mounted, setMounted] = useState(false);
	const [typed, setTyped] = useState("");
	const confirmed = typed.trim().toLowerCase() === confirmPhrase;

	// Portal keeps the dialog form outside SettingsFormShell's outer <form>.
	useEffect(() => {
		setMounted(true);
	}, []);

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

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (confirmed && !isBusy) onConfirm();
	}

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
					className={DESTRUCTIVE_CONFIRM_OVERLAY_CLASS}
					onClick={isBusy ? undefined : onClose}
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
						onClick={(e) => e.stopPropagation()}
						className={cn(
							"relative flex min-h-[22rem] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:min-h-[24rem] sm:rounded-[2.25rem]",
						)}
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
								{title}
							</h2>

							<div
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose space-y-2 text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base"
							>
								{children}
							</div>

							<form
								id={FORM_ID}
								onSubmit={handleSubmit}
								className="mt-6 w-full space-y-4 sm:mt-8"
							>
								<div className="space-y-2">
									<Label
										htmlFor={inputId}
										className="w-full justify-center text-center text-muted-foreground text-xs"
									>
										Type{" "}
										<span className="font-medium text-foreground">
											{confirmPhrase}
										</span>{" "}
										to confirm
									</Label>
									<Input
										id={inputId}
										value={typed}
										onChange={(e) => setTyped(e.target.value)}
										placeholder={confirmPhrase}
										autoComplete="off"
										spellCheck={false}
										disabled={isBusy}
										className={CONFIRM_FIELD_CLASS}
									/>
									{error ? (
										<p className="text-center text-destructive text-xs leading-relaxed">
											{error}
										</p>
									) : null}
								</div>
							</form>

							<div className="mt-auto flex w-full flex-col-reverse gap-2 pt-8 sm:flex-row sm:justify-center sm:gap-3 sm:pt-10">
								<DetailMotionButtonWrap>
									<Button
										type="submit"
										form={FORM_ID}
										variant="ghost"
										size="pill"
										disabled={!confirmed || isBusy}
										className={cn(
											"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-destructive sm:w-auto sm:min-w-34",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
									>
										{isBusy ? (
											<span className="inline-flex items-center gap-2">
												<Loader2
													className="size-3.5 animate-spin"
													aria-hidden
												/>
												{busyLabel}
											</span>
										) : (
											confirmLabel
										)}
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										disabled={isBusy}
										className="hover:!bg-foreground hover:!text-background h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background text-base sm:w-auto sm:min-w-34 [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
										onClick={onClose}
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
