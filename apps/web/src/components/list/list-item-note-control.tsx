"use client";

import { Textarea } from "@still/ui/components/textarea";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ListItemNoteDisplay } from "@/components/list/list-item-note-display";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { LIST_ITEM_NOTE_MAX_CHARS } from "@/lib/list-quality";
import { patchListItemNote } from "@/lib/still-api-fetch";

/** Matches list create/edit dialogs — flat canvas field on card surfaces. */
const LIST_NOTE_FIELD_CLASS =
	"min-h-[4.5rem] resize-y rounded-xl border-transparent bg-card/60 px-3 py-2.5 font-editorial text-foreground text-sm leading-relaxed shadow-none outline-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none";

const NOTE_MOTION_SPRING = {
	type: "spring",
	stiffness: 380,
	damping: 28,
} as const;

/**
 * Per-title curator note on list detail — editorial read state + inline edit sheet (SN.10).
 */
export function ListItemNoteControl({
	listId,
	itemId,
	initialNote,
	titleLabel,
	className,
	displayLineClamp = 4,
}: {
	listId: string;
	itemId: string;
	initialNote: string | null;
	titleLabel: string;
	className?: string;
	displayLineClamp?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
	const fieldId = useId();
	const reduceMotion = useReducedMotion();
	const [savedNote, setSavedNote] = useState(initialNote?.trim() ?? "");
	const [draft, setDraft] = useState(initialNote ?? "");
	const [editing, setEditing] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const trimmed = initialNote?.trim() ?? "";
		setSavedNote(trimmed);
		setDraft(initialNote ?? "");
		setEditing(false);
	}, [initialNote, itemId]);

	const charsUsed = draft.trim().length;
	const atLimit = charsUsed >= LIST_ITEM_NOTE_MAX_CHARS;

	async function persist(next: string) {
		setBusy(true);
		try {
			const res = await patchListItemNote(listId, itemId, next);
			if (!res.ok) {
				toast.error("Couldn't save note");
				return;
			}
			const trimmed = next.trim();
			setSavedNote(trimmed);
			setDraft(trimmed);
			setEditing(false);
		} catch (err) {
			console.error(err);
			toast.error("Couldn't save note");
		} finally {
			setBusy(false);
		}
	}

	function openEditor() {
		setDraft(savedNote || draft);
		setEditing(true);
	}

	function cancelEditor() {
		setDraft(savedNote);
		setEditing(false);
	}

	function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Escape") {
			event.preventDefault();
			cancelEditor();
			return;
		}
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			if (!busy) void persist(draft);
		}
	}

	return (
		<div className={cn("mt-2 w-full min-w-0", className)}>
			<AnimatePresence mode="wait" initial={false}>
				{editing ? (
					<motion.div
						key="editor"
						initial={reduceMotion ? false : { opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
						transition={NOTE_MOTION_SPRING}
						className="overflow-hidden"
					>
						<div className="rounded-2xl bg-background px-3 py-3">
							<label htmlFor={fieldId} className="sr-only">
								Curator note for {titleLabel}
							</label>
							<Textarea
								id={fieldId}
								rows={3}
								maxLength={LIST_ITEM_NOTE_MAX_CHARS}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={handleEditorKeyDown}
								placeholder="Why does this title belong here?"
								spellCheck
								disabled={busy}
								className={LIST_NOTE_FIELD_CLASS}
							/>
							<div className="mt-2 flex items-center justify-between gap-2">
								<p
									className={cn(
										"text-[11px] tabular-nums tracking-tight",
										atLimit ? "text-desert-orange" : "text-muted-foreground",
									)}
									aria-live="polite"
								>
									{charsUsed}/{LIST_ITEM_NOTE_MAX_CHARS}
								</p>
								<div className="flex flex-wrap items-center justify-end gap-1.5">
									<DetailMotionButtonWrap>
										<button
											type="button"
											disabled={busy}
											onClick={cancelEditor}
											className={cn(
												"inline-flex min-h-8 select-none items-center rounded-full px-3 py-1.5 font-medium text-muted-foreground text-xs",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
										>
											Cancel
										</button>
									</DetailMotionButtonWrap>
									<DetailMotionButtonWrap>
										<button
											type="button"
											disabled={busy}
											onClick={() => void persist(draft)}
											className="inline-flex min-h-8 select-none items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 font-semibold text-background text-xs disabled:opacity-60"
										>
											{busy ? (
												<Loader2
													className="size-3.5 animate-spin"
													aria-hidden
												/>
											) : null}
											Save
										</button>
									</DetailMotionButtonWrap>
								</div>
							</div>
						</div>
					</motion.div>
				) : savedNote ? (
					<motion.div
						key="display"
						initial={reduceMotion ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={reduceMotion ? undefined : { opacity: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.18 }}
						className="space-y-2"
					>
						<ListItemNoteDisplay
							note={savedNote}
							lineClamp={displayLineClamp}
						/>
						<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
							<DetailMotionButtonWrap>
								<button
									type="button"
									onClick={openEditor}
									className={cn(
										"inline-flex min-h-7 select-none items-center gap-1 rounded-full px-2 py-1 font-medium text-[11px] text-muted-foreground tracking-wide",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
								>
									<IconPen2Fill
										size="14px"
										className="shrink-0 opacity-80"
										aria-hidden
									/>
									Edit
								</button>
							</DetailMotionButtonWrap>
							<button
								type="button"
								disabled={busy}
								onClick={() => void persist("")}
								className="min-h-7 select-none rounded-full px-2 py-1 font-medium text-[11px] text-muted-foreground/80 tracking-wide hover:text-foreground disabled:opacity-50"
							>
								Remove
							</button>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="empty"
						initial={reduceMotion ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={reduceMotion ? undefined : { opacity: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.18 }}
						className="flex justify-center"
					>
						<DetailMotionButtonWrap>
							<button
								type="button"
								onClick={openEditor}
								className={cn(
									"inline-flex min-h-8 select-none items-center gap-1.5 rounded-full bg-background px-3 py-1.5 font-medium text-[11px] text-muted-foreground tracking-wide",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
							>
								<IconPen2Fill
									size="14px"
									className="shrink-0 opacity-80"
									aria-hidden
								/>
								Add curator note
							</button>
						</DetailMotionButtonWrap>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
