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
import { Loader2 } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import {
	type FormEvent,
	type RefObject,
	useCallback,
	useEffect,
	useState,
} from "react";
import { toast } from "sonner";

import { ListDescriptionQualityHint } from "@/components/list/list-description-quality-hint";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import {
	type AddToListMedia,
	addToListItemPostBody,
} from "@/lib/add-to-list-media";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { SHEET_FIELD_CLASS, SHEET_FIELD_LABEL_CLASS } from "@/lib/sheet-chrome";

export const CREATE_LIST_FORM_ID = "create-list-form";

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;

/** Copy for create-list segment hover tooltips — what it means + when to pick it. */
export const CREATE_LIST_VISIBILITY_TOOLTIPS = {
	public:
		"Anyone can find this list on your profile and in community feeds.\nGood for recommendations, shared watchlists, and lists you want friends to discover.",
	private:
		"Only you can see this list—it stays off your public profile and out of feeds.\nGood for personal queues, drafts, and planning you are not ready to share.",
} as const;

export const CREATE_LIST_ORDERING_TOOLTIPS = {
	standard:
		"Films stay in the order you add them, without rank numbers on the list page.\nGood for theme nights, someday piles, and collections where order is casual.",
	ranked:
		"Each film shows its place (1., 2., 3.) on the list page.\nGood for top 10s, year-end lists, and any ranking where position is the point.",
} as const;

export type CreateListSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	media?: AddToListMedia;
	movieId?: number;
	movieTitle?: string;
	onCreated?: (listId: string) => void;
};

export function resolveCreateListSeedMedia(
	media: AddToListMedia | undefined,
	movieId: number | undefined,
	movieTitle: string | undefined,
): AddToListMedia | null {
	if (media) return media;
	if (typeof movieId === "number") {
		return {
			listingKind: "movie",
			tmdbId: movieId,
			title: movieTitle ?? "",
		};
	}
	return null;
}

export function useCreateListForm({
	open,
	onOpenChange,
	seedMedia,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	seedMedia: AddToListMedia | null;
	onCreated?: (listId: string) => void;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [isPublic, setIsPublic] = useState(true);
	const [isRanked, setIsRanked] = useState(false);
	const [saving, setSaving] = useState(false);

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		if (!open) {
			setTitle("");
			setDescription("");
			setIsPublic(true);
			setIsRanked(false);
		}
	}, [open]);

	const subtitle = seedMedia?.title
		? `“${seedMedia.title}” joins this list as soon as you create it.`
		: "Organize films and shows into a ranked or casual collection.";

	const canCreate = title.trim().length > 0;

	async function submit(e: FormEvent) {
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
			console.error("[create-list]", err);
			toast.error("Couldn't create list");
		} finally {
			setSaving(false);
		}
	}

	return {
		title,
		setTitle,
		description,
		setDescription,
		isPublic,
		setIsPublic,
		isRanked,
		setIsRanked,
		saving,
		canCreate,
		subtitle,
		submit,
		handleClose,
	};
}

/** @deprecated Use {@link SHEET_FIELD_CLASS} from `@/lib/sheet-chrome`. */
export const CREATE_LIST_FIELD_CLASS = SHEET_FIELD_CLASS;

export function createListSegmentChip(active: boolean) {
	return cn(
		"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
		active
			? "text-foreground"
			: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
	);
}

export const CREATE_LIST_SEGMENT_PILL_TRANSITION = {
	type: "tween" as const,
	duration: 0.22,
	ease: SHEET_EASE,
};

type CreateListFormContentProps = {
	subtitle: string;
	title: string;
	setTitle: (value: string) => void;
	description: string;
	setDescription: (value: string) => void;
	isPublic: boolean;
	setIsPublic: (value: boolean) => void;
	isRanked: boolean;
	setIsRanked: (value: boolean) => void;
	submit: (e: FormEvent) => void;
	autoFocusTitle?: boolean;
	/** Drawer panel renders title in a filmography-style header block. */
	omitHeader?: boolean;
	pillLayoutSuffix?: string;
	titleClassName?: string;
	subtitleClassName?: string;
};

/** Shared create-list fields — used by mobile Vaul drawer and desktop dialog. */
export function CreateListFormContent({
	subtitle,
	title,
	setTitle,
	description,
	setDescription,
	isPublic,
	setIsPublic,
	isRanked,
	setIsRanked,
	submit,
	autoFocusTitle = false,
	omitHeader = false,
	pillLayoutSuffix = "",
	titleClassName,
	subtitleClassName,
}: CreateListFormContentProps) {
	return (
		<>
			{omitHeader ? null : (
				<>
					<h2
						id="create-list-title"
						className={cn(
							"mb-2 text-balance text-center font-sans font-semibold text-foreground text-xl leading-snug tracking-tight",
							titleClassName,
						)}
					>
						New list
					</h2>
					<p
						className={cn(
							"mb-6 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base",
							subtitleClassName,
						)}
					>
						{subtitle}
					</p>
				</>
			)}

			<form id={CREATE_LIST_FORM_ID} onSubmit={submit} className="space-y-5">
				<div className="space-y-2">
					<Label
						htmlFor="create-list-title-input"
						className={SHEET_FIELD_LABEL_CLASS}
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
						className={SHEET_FIELD_CLASS}
						autoFocus={autoFocusTitle}
					/>
				</div>
				<div className="space-y-2">
					<Label
						htmlFor="create-list-description"
						className={SHEET_FIELD_LABEL_CLASS}
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
							SHEET_FIELD_CLASS,
							"min-h-40 resize-y py-3 leading-relaxed",
						)}
					/>
					<ListDescriptionQualityHint
						description={description}
						isPublic={isPublic}
					/>
				</div>

				<TooltipProvider delay={280} closeDelay={80}>
					<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 pb-2 sm:flex-row sm:justify-center sm:gap-3">
						<fieldset className="w-fit border-0 p-0">
							<legend className="mb-2 block w-full text-center text-muted-foreground text-xs">
								Visibility
							</legend>
							<LayoutGroup id={`create-list-visibility${pillLayoutSuffix}`}>
								<div className="flex w-fit items-center rounded-full bg-background p-1">
									<CreateListSegmentOption
										active={isPublic}
										label="Public"
										tooltip={CREATE_LIST_VISIBILITY_TOOLTIPS.public}
										pillLayoutId={`create-list-visibility-pill${pillLayoutSuffix}`}
										onSelect={() => setIsPublic(true)}
									/>
									<CreateListSegmentOption
										active={!isPublic}
										label="Private"
										tooltip={CREATE_LIST_VISIBILITY_TOOLTIPS.private}
										pillLayoutId={`create-list-visibility-pill${pillLayoutSuffix}`}
										onSelect={() => setIsPublic(false)}
									/>
								</div>
							</LayoutGroup>
						</fieldset>

						<fieldset className="w-fit border-0 p-0">
							<legend className="mb-2 block w-full text-center text-muted-foreground text-xs">
								Ordering
							</legend>
							<LayoutGroup id={`create-list-ordering${pillLayoutSuffix}`}>
								<div className="flex w-fit items-center rounded-full bg-background p-1">
									<CreateListSegmentOption
										active={!isRanked}
										label="Standard"
										tooltip={CREATE_LIST_ORDERING_TOOLTIPS.standard}
										pillLayoutId={`create-list-ordering-pill${pillLayoutSuffix}`}
										onSelect={() => setIsRanked(false)}
									/>
									<CreateListSegmentOption
										active={isRanked}
										label="Ranked"
										tooltip={CREATE_LIST_ORDERING_TOOLTIPS.ranked}
										pillLayoutId={`create-list-ordering-pill${pillLayoutSuffix}`}
										onSelect={() => setIsRanked(true)}
									/>
								</div>
							</LayoutGroup>
						</fieldset>
					</div>
				</TooltipProvider>
			</form>
		</>
	);
}

type CreateListSheetFooterProps = {
	saving: boolean;
	canCreate: boolean;
	onClose: () => void;
	variant: "drawer" | "dialog" | "inline";
};

/** Cancel + Create list actions — inline lives inside the drawer scrollport. */
export function CreateListSheetFooter({
	saving,
	canCreate,
	onClose,
	variant,
}: CreateListSheetFooterProps) {
	return (
		<footer
			className={cn(
				"flex items-center justify-between gap-3",
				variant === "drawer" &&
					"relative z-40 shrink-0 bg-card px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]",
				variant === "dialog" &&
					"absolute inset-x-3 bottom-3 z-20 md:inset-x-4 md:bottom-4",
				variant === "inline" && "px-1",
			)}
		>
			<DetailMotionButtonWrap>
				<Button
					type="button"
					variant="ghost"
					size="pill"
					className={cn(
						"h-auto min-h-10 min-w-22 border-transparent bg-background py-2.5 text-muted-foreground",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					disabled={saving}
					onClick={onClose}
				>
					Cancel
				</Button>
			</DetailMotionButtonWrap>
			<DetailMotionButtonWrap>
				<Button
					type="submit"
					form={CREATE_LIST_FORM_ID}
					variant="default"
					size="pill"
					className="h-auto min-h-10 min-w-34 bg-foreground px-5 py-2.5 text-background text-base hover:bg-foreground! hover:text-background! [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
					disabled={!canCreate || saving}
				>
					{saving ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
					) : null}
					Create list
				</Button>
			</DetailMotionButtonWrap>
		</footer>
	);
}

function CreateListSegmentOption({
	active,
	label,
	tooltip,
	pillLayoutId,
	onSelect,
}: {
	active: boolean;
	label: string;
	tooltip: string;
	pillLayoutId: string;
	onSelect: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						className={createListSegmentChip(active)}
						aria-pressed={active}
						onClick={onSelect}
					>
						{active ? (
							<motion.span
								layoutId={pillLayoutId}
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={CREATE_LIST_SEGMENT_PILL_TRANSITION}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				}
			/>
			<TooltipContent className="w-fit max-w-76 whitespace-pre-line text-balance text-center">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

export function useCreateListScrollFadesKey(
	description: string,
	isPublic: boolean,
	isRanked: boolean,
) {
	return `${description}:${isPublic}:${isRanked}`;
}

export type CreateListScrollRef = RefObject<HTMLDivElement | null>;
