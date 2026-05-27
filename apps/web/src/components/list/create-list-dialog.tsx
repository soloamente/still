"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import {
	type AddToListMedia,
	addToListItemPostBody,
} from "@/lib/add-to-list-media";
import { api } from "@/lib/api";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;
const FORM_ID = "create-list-form";

/** Copy for create-list segment hover tooltips — what it means + when to pick it. */
const CREATE_LIST_VISIBILITY_TOOLTIPS = {
	public:
		"Anyone can find this list on your profile and in community feeds.\nGood for recommendations, shared watchlists, and lists you want friends to discover.",
	private:
		"Only you can see this list—it stays off your public profile and out of feeds.\nGood for personal queues, drafts, and planning you are not ready to share.",
} as const;

const CREATE_LIST_ORDERING_TOOLTIPS = {
	standard:
		"Films stay in the order you add them, without rank numbers on the list page.\nGood for theme nights, someday piles, and collections where order is casual.",
	ranked:
		"Each film shows its place (1., 2., 3.) on the list page.\nGood for top 10s, year-end lists, and any ranking where position is the point.",
} as const;

export type CreateListDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** When set, the new list receives this title immediately after creation. */
	media?: AddToListMedia;
	/** @deprecated Prefer `media`. */
	movieId?: number;
	/** @deprecated Prefer `media`. */
	movieTitle?: string;
	/** Called after list (+ optional title) is saved successfully. */
	onCreated?: (listId: string) => void;
};

/**
 * Create-list sheet — mirrors `ReviewComposerRoot` / `QuickLogRoot` layout, footer,
 * field chrome, and segmented toggles (About | Streaming style) so hero “Add to list” feels native.
 */
export function CreateListDialog({
	open,
	onOpenChange,
	media,
	movieId,
	movieTitle,
	onCreated,
}: CreateListDialogProps) {
	const seedMedia: AddToListMedia | null =
		media ??
		(typeof movieId === "number"
			? {
					listingKind: "movie",
					tmdbId: movieId,
					title: movieTitle ?? "",
				}
			: null);
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [isPublic, setIsPublic] = useState(true);
	const [isRanked, setIsRanked] = useState(false);
	const [saving, setSaving] = useState(false);
	const [showFooterFade, setShowFooterFade] = useState(true);

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			setTitle("");
			setDescription("");
			setIsPublic(true);
			setIsRanked(false);
			setShowFooterFade(true);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleClose]);

	const syncFooterFade = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		setShowFooterFade(distanceFromBottom > 8);
	}, []);

	useEffect(() => {
		if (!open) return;
		const el = scrollRef.current;
		if (!el) return;
		syncFooterFade();
		el.addEventListener("scroll", syncFooterFade, { passive: true });
		return () => el.removeEventListener("scroll", syncFooterFade);
	}, [open, syncFooterFade]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) {
			toast.error("Lists need a title");
			return;
		}
		setSaving(true);
		try {
			const res = await api.api.lists.post({
				title: trimmed,
				description: description.trim() || undefined,
				isPublic,
				isRanked,
			});
			const created = res.data as { id?: string; title?: string } | null;
			const listId = created?.id;
			if (!listId) {
				toast.error("Couldn't create list");
				return;
			}

			if (seedMedia) {
				await api.api
					.lists({ id: listId })
					.items.post(addToListItemPostBody(seedMedia));
			}

			const label = created?.title ?? trimmed;
			toast.success(
				seedMedia?.title
					? `Added ${seedMedia.title} to ${label}`
					: `Created ${label}`,
			);
			onCreated?.(listId);
			handleClose();
		} catch (err) {
			console.error("[create-list-dialog]", err);
			toast.error("Couldn't create list");
		} finally {
			setSaving(false);
		}
	}

	const dialogLayoutTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.32, ease: SHEET_EASE };

	const segmentPillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: SHEET_EASE,
			};

	const fieldClass =
		"min-h-11 rounded-2xl border-transparent bg-background text-base shadow-none outline-none focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

	/** Match movie detail About | Streaming and quick-log venue chips (track + sliding pill). */
	const segmentChip = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const canCreate = title.trim().length > 0;

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
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
						style={
							{
								"--log-rating-accent": "oklch(0.72 0.14 250)",
							} as CSSProperties
						}
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
							<div
								ref={scrollRef}
								className="max-h-[min(calc(92svh-11rem),640px)] overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							>
								<h2
									id="create-list-title"
									className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
								>
									New list
								</h2>
								<p className="mb-6 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									{seedMedia?.title
										? `“${seedMedia.title}” joins this list as soon as you create it.`
										: "Organize films and shows into a ranked or casual collection."}
								</p>

								<form id={FORM_ID} onSubmit={submit} className="space-y-5">
									<div className="space-y-2">
										<Label
											htmlFor="create-list-title-input"
											className="w-full justify-center text-center text-muted-foreground text-xs"
										>
											Title
										</Label>
										<Input
											id="create-list-title-input"
											required
											maxLength={120}
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="My top ten of the year"
											autoComplete="off"
											spellCheck={false}
											className={fieldClass}
											autoFocus
										/>
									</div>
									<div className="space-y-2">
										<Label
											htmlFor="create-list-description"
											className="w-full justify-center text-center text-muted-foreground text-xs"
										>
											Description (optional)
										</Label>
										<Textarea
											id="create-list-description"
											rows={4}
											maxLength={4000}
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											placeholder="What is this list about?"
											spellCheck
											className={cn(
												fieldClass,
												"min-h-[10rem] resize-y py-3 leading-relaxed",
											)}
										/>
									</div>

									<TooltipProvider delay={280} closeDelay={80}>
										<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 pb-2 sm:flex-row sm:justify-center sm:gap-3">
											<fieldset className="w-fit border-0 p-0">
												<legend className="mb-2 block w-full text-center text-muted-foreground text-xs">
													Visibility
												</legend>
												<LayoutGroup id="create-list-visibility">
													<div className="flex w-fit items-center rounded-full bg-background p-1">
														<CreateListSegmentOption
															active={isPublic}
															label="Public"
															tooltip={CREATE_LIST_VISIBILITY_TOOLTIPS.public}
															pillLayoutId="create-list-visibility-pill"
															segmentChip={segmentChip}
															segmentPillTransition={segmentPillTransition}
															onSelect={() => setIsPublic(true)}
														/>
														<CreateListSegmentOption
															active={!isPublic}
															label="Private"
															tooltip={CREATE_LIST_VISIBILITY_TOOLTIPS.private}
															pillLayoutId="create-list-visibility-pill"
															segmentChip={segmentChip}
															segmentPillTransition={segmentPillTransition}
															onSelect={() => setIsPublic(false)}
														/>
													</div>
												</LayoutGroup>
											</fieldset>

											<fieldset className="w-fit border-0 p-0">
												<legend className="mb-2 block w-full text-center text-muted-foreground text-xs">
													Ordering
												</legend>
												<LayoutGroup id="create-list-ordering">
													<div className="flex w-fit items-center rounded-full bg-background p-1">
														<CreateListSegmentOption
															active={!isRanked}
															label="Standard"
															tooltip={CREATE_LIST_ORDERING_TOOLTIPS.standard}
															pillLayoutId="create-list-ordering-pill"
															segmentChip={segmentChip}
															segmentPillTransition={segmentPillTransition}
															onSelect={() => setIsRanked(false)}
														/>
														<CreateListSegmentOption
															active={isRanked}
															label="Ranked"
															tooltip={CREATE_LIST_ORDERING_TOOLTIPS.ranked}
															pillLayoutId="create-list-ordering-pill"
															segmentChip={segmentChip}
															segmentPillTransition={segmentPillTransition}
															onSelect={() => setIsRanked(true)}
														/>
													</div>
												</LayoutGroup>
											</fieldset>
										</div>
									</TooltipProvider>
								</form>
							</div>
							<div
								aria-hidden
								className={cn(
									"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
									showFooterFade ? "opacity-100" : "opacity-0",
								)}
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
									disabled={!canCreate || saving}
								>
									{saving ? (
										<Loader2 className="size-3.5 animate-spin" aria-hidden />
									) : null}
									Create list
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

type CreateListSegmentOptionProps = {
	active: boolean;
	label: string;
	tooltip: string;
	pillLayoutId: string;
	segmentChip: (active: boolean) => string;
	segmentPillTransition:
		| { duration: number }
		| {
				type: "tween";
				duration: number;
				ease: readonly [number, number, number, number];
		  };
	onSelect: () => void;
};

/** Segmented chip with a styled hover tooltip (Base UI, not native `title`). */
function CreateListSegmentOption({
	active,
	label,
	tooltip,
	pillLayoutId,
	segmentChip,
	segmentPillTransition,
	onSelect,
}: CreateListSegmentOptionProps) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						className={segmentChip(active)}
						aria-pressed={active}
						onClick={onSelect}
					>
						{active ? (
							<motion.span
								layoutId={pillLayoutId}
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={segmentPillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				}
			/>
			<TooltipContent className="w-fit max-w-[19rem] whitespace-pre-line text-balance text-center">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}
