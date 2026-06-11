"use client";

import { Button } from "@still/ui/components/button";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
	CreateListFormContent,
	CreateListSheetFooter,
	type CreateListSheetProps,
	resolveCreateListSeedMedia,
	useCreateListForm,
	useCreateListScrollFadesKey,
} from "@/components/list/create-list-form";
import { ModalSheetScrollScrims } from "@/components/ui/modal-sheet-scroll-scrims";
import {
	APP_MODAL_OVERLAY_CLASS,
	MODAL_SHEET_SCROLL_CLASS,
} from "@/lib/app-modal-layer";
import { shouldOpenCreateListDrawer } from "@/lib/open-create-list-surface";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;

export type CreateListDialogProps = CreateListSheetProps;

/**
 * Desktop create-list modal (`md+`). On mobile, callers should use
 * {@link openCreateListDrawer} — the global Vaul sheet in `AppShell`.
 */
export function CreateListDialog({
	open,
	onOpenChange,
	media,
	movieId,
	movieTitle,
	onCreated,
}: CreateListDialogProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Mobile always uses the app-shell Vaul drawer — never this modal.
	if (!mounted || shouldOpenCreateListDrawer()) {
		return null;
	}

	return (
		<CreateListDesktopDialog
			open={open}
			onOpenChange={onOpenChange}
			media={media}
			movieId={movieId}
			movieTitle={movieTitle}
			onCreated={onCreated}
		/>
	);
}

function CreateListDesktopDialog({
	open,
	onOpenChange,
	media,
	movieId,
	movieTitle,
	onCreated,
}: CreateListSheetProps) {
	const seedMedia = resolveCreateListSeedMedia(media, movieId, movieTitle);
	const reduceMotion = useReducedMotion();
	const scrollRef = useRef<HTMLDivElement>(null);

	const form = useCreateListForm({
		open,
		onOpenChange,
		seedMedia,
		onCreated,
	});
	const { handleClose } = form;

	const scrollFadesKey = useCreateListScrollFadesKey(
		form.description,
		form.isPublic,
		form.isRanked,
	);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		scrollFadesKey,
	);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleClose]);

	const dialogLayoutTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.32, ease: SHEET_EASE };

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
						aria-labelledby="create-list-title"
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
						onClick={(e) => e.stopPropagation()}
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:px-8 md:pt-10"
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
								<X className="size-4" />
							</Button>
						</div>

						<div className="relative min-h-0 flex-1">
							<div ref={scrollRef} className={MODAL_SHEET_SCROLL_CLASS}>
								<CreateListFormContent
									subtitle={form.subtitle}
									title={form.title}
									setTitle={form.setTitle}
									description={form.description}
									setDescription={form.setDescription}
									isPublic={form.isPublic}
									setIsPublic={form.setIsPublic}
									isRanked={form.isRanked}
									setIsRanked={form.setIsRanked}
									submit={form.submit}
									autoFocusTitle
									titleClassName="text-xl sm:text-2xl"
								/>
							</div>
							<ModalSheetScrollScrims
								showHeaderFade={showHeaderFade}
								showFooterFade={showFooterFade}
							/>
						</div>

						<CreateListSheetFooter
							variant="dialog"
							saving={form.saving}
							canCreate={form.canCreate}
							onClose={handleClose}
						/>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
