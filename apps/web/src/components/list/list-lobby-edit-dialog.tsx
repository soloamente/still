"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { ListDescriptionQualityHint } from "@/components/list/list-description-quality-hint";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { ModalSheetScrollScrims } from "@/components/ui/modal-sheet-scroll-scrims";
import { api } from "@/lib/api";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;
const FORM_ID = "edit-list-form";

export function ListLobbyEditDialog({
	open,
	onOpenChange,
	listId,
	initialTitle,
	initialDescription = "",
	isPublic = true,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	listId: string;
	initialTitle: string;
	initialDescription?: string | null;
	isPublic?: boolean;
	onSaved?: (payload: { title: string; description: string }) => void;
}) {
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [title, setTitle] = useState(initialTitle);
	const [description, setDescription] = useState(initialDescription ?? "");
	const [saving, setSaving] = useState(false);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		`${title}|${description}`,
	);

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		setTitle(initialTitle);
		setDescription(initialDescription ?? "");
	}, [open, initialTitle, initialDescription]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleClose]);

	async function handleSave(event: React.FormEvent) {
		event.preventDefault();
		const nextTitle = title.trim();
		const nextDescription = description.trim();
		if (!nextTitle || saving) return;

		const initialDesc = (initialDescription ?? "").trim();
		if (nextTitle === initialTitle.trim() && nextDescription === initialDesc) {
			handleClose();
			return;
		}

		setSaving(true);
		try {
			const res = await api.api.lists({ id: listId }).patch({
				title: nextTitle,
				description: nextDescription || undefined,
			});
			if (res.error) {
				toast.error("Couldn't update list");
				return;
			}
			toast.success("List updated");
			onSaved?.({ title: nextTitle, description: nextDescription });
			handleClose();
		} catch {
			toast.error("Couldn't update list");
		} finally {
			setSaving(false);
		}
	}

	const dialogLayoutTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.32, ease: SHEET_EASE };

	const fieldClass =
		"min-h-11 rounded-2xl border-transparent bg-background text-base shadow-none outline-none focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

	const canSave = title.trim().length > 0;

	if (!mounted) return null;

	const portal = (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className={APP_MODAL_OVERLAY_CLASS}
					onClick={handleClose}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="edit-list-title"
						layout
						layoutRoot
						initial={{ y: 32, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 16, opacity: 0, scale: 0.98 }}
						transition={{
							duration: 0.18,
							ease: SHEET_EASE,
							layout: dialogLayoutTransition,
						}}
						onClick={(event) => event.stopPropagation()}
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
					>
						<div className="mb-4 flex justify-end">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={handleClose}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="relative min-h-0 flex-1">
							<div
								ref={scrollRef}
								className="max-h-[min(calc(92svh-11rem),640px)] overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							>
								<h2
									id="edit-list-title"
									className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
								>
									Edit list
								</h2>
								<p className="mb-6 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									Update the title and description shown on your list page.
								</p>

								<form
									id={FORM_ID}
									onSubmit={(event) => void handleSave(event)}
									className="space-y-5"
								>
									<div className="space-y-2">
										<Label
											htmlFor="edit-list-title-input"
											className="w-full justify-center text-center text-muted-foreground text-xs"
										>
											Title
										</Label>
										<Input
											id="edit-list-title-input"
											required
											maxLength={120}
											value={title}
											onChange={(event) => setTitle(event.target.value)}
											placeholder="My top ten of the year"
											autoComplete="off"
											spellCheck={false}
											className={fieldClass}
											autoFocus
										/>
									</div>
									<div className="space-y-2">
										<Label
											htmlFor="edit-list-description"
											className="w-full justify-center text-center text-muted-foreground text-xs"
										>
											Description (optional)
										</Label>
										<Textarea
											id="edit-list-description"
											rows={4}
											maxLength={4000}
											value={description}
											onChange={(event) => setDescription(event.target.value)}
											placeholder="What is this list about?"
											spellCheck
											className={cn(
												fieldClass,
												"min-h-[10rem] resize-y py-3 leading-relaxed",
											)}
										/>
										<ListDescriptionQualityHint
											description={description}
											isPublic={isPublic}
										/>
									</div>
								</form>
							</div>
							<ModalSheetScrollScrims
								showHeaderFade={showHeaderFade}
								showFooterFade={showFooterFade}
							/>
						</div>

						<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
							<DetailMotionButtonWrap>
								<Button
									type="button"
									variant="ghost"
									size="pill"
									className={cn(
										"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									disabled={saving}
									onClick={handleClose}
								>
									Cancel
								</Button>
							</DetailMotionButtonWrap>
							<DetailMotionButtonWrap>
								<Button
									type="submit"
									form={FORM_ID}
									variant="default"
									size="pill"
									className="hover:!bg-foreground hover:!text-background h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-background text-base [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
									disabled={!canSave || saving}
								>
									{saving ? (
										<Loader2 className="size-3.5 animate-spin" aria-hidden />
									) : null}
									Save changes
								</Button>
							</DetailMotionButtonWrap>
						</footer>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
