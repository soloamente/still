"use client";

import {
	RadialToolkit,
	type RadialToolkitItem,
	useRadialToolkitAnchor,
} from "@still/ui/components/radial-toolkit";
import IconCloneImageDashedFill from "@still/ui/icons/clone-image-dashed-fill";
import IconGlobePointerFill from "@still/ui/icons/globe-pointer-fill";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import IconLinkFill from "@still/ui/icons/link-fill";
import IconListPlay from "@still/ui/icons/list-play";
import IconLockFill from "@still/ui/icons/lock-fill";
import IconOpenExternalFill from "@still/ui/icons/open-external-fill";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconTrashXmarkFill from "@still/ui/icons/trash-xmark-fill";
import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { ListLobbyDeleteConfirmDialog } from "@/components/list/list-lobby-delete-confirm-dialog";
import { ListLobbyEditDialog } from "@/components/list/list-lobby-edit-dialog";
import { api } from "@/lib/api";
import {
	isListCoverProxySrc,
	resolveListCoverImageSrc,
} from "@/lib/list-cover-image";
import { listShareCopiedToastMessage } from "@/lib/list-share-toast";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";
import { uploadListCover } from "@/lib/upload-list-cover";

/**
 * One list in the home-style poster wall — same elevation shell as `MoviePoster` lobby cells.
 */
export function ListLobbyPoster({
	list,
	priority = false,
	className,
	frameClassName,
}: {
	list: ListLobbySeed;
	priority?: boolean;
	className?: string;
	frameClassName?: string;
}) {
	const router = useRouter();
	const coverInputId = useId();
	const coverInputRef = useRef<HTMLInputElement>(null);
	const { open, anchor, onContextMenu, onPointerDown, onOpenChange } =
		useRadialToolkitAnchor();
	const [deleting, setDeleting] = useState(false);
	const [togglingPrivacy, setTogglingPrivacy] = useState(false);
	const [uploadingCover, setUploadingCover] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [displayTitle, setDisplayTitle] = useState(list.title);
	const [displayDescription, setDisplayDescription] = useState(
		list.description ?? "",
	);
	const [displayPosterUrl, setDisplayPosterUrl] = useState(list.poster_url);
	const [isPublic, setIsPublic] = useState(list.isPublic);

	useEffect(() => {
		setDisplayTitle(list.title);
		setDisplayDescription(list.description ?? "");
		setDisplayPosterUrl(list.poster_url);
		setIsPublic(list.isPublic);
	}, [list.title, list.description, list.poster_url, list.isPublic]);

	const imageSizes =
		"(max-width: 640px) 38vw, (max-width: 1024px) 28vw, (max-width: 1536px) 220px, 260px";

	const listHref = `/lists/${list.id}`;
	const isFavoritesList = list.systemKind === "favorites";
	const isSharedList = list.listRole === "collaborator";

	const shellClassName = cn(
		"group block w-full min-w-0",
		"relative z-0 overflow-visible transition-[box-shadow,z-index] duration-200 ease-out",
		"motion-reduce:transition-none motion-reduce:hover:shadow-none motion-reduce:focus-within:shadow-none",
		"focus-within:z-[100] [@media(hover:hover)]:hover:z-[100]",
		"[@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
		"focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
		className,
	);

	const frameShellClassName = cn(
		"poster-art relative aspect-[2/3] w-full overflow-hidden rounded-md border-0 bg-card transition-colors duration-200 ease-out",
		frameClassName,
	);

	const metaLine = `${list.itemsCount} ${list.itemsCount === 1 ? "title" : "titles"}`;
	const likesLine = `${list.likesCount} ${list.likesCount === 1 ? "like" : "likes"}`;

	const handleCopyLink = useCallback(async () => {
		const href =
			typeof window !== "undefined"
				? `${window.location.origin}${listHref}`
				: listHref;
		try {
			await navigator.clipboard.writeText(href);
			toast.success(listShareCopiedToastMessage(list.title));
			onOpenChange(false);
		} catch {
			toast.error("Couldn't copy link");
		}
	}, [listHref, list.title, onOpenChange]);

	const handleTogglePrivacy = useCallback(async () => {
		if (isFavoritesList || togglingPrivacy) return;
		const next = !isPublic;
		setTogglingPrivacy(true);
		try {
			const res = await api.api
				.lists({ id: list.id })
				.patch({ isPublic: next });
			if (res.error) {
				toast.error("Couldn't update visibility");
				return;
			}
			setIsPublic(next);
			toast.success(next ? "List is now public" : "List is now private");
			onOpenChange(false);
			router.refresh();
		} catch {
			toast.error("Couldn't update visibility");
		} finally {
			setTogglingPrivacy(false);
		}
	}, [
		isFavoritesList,
		isPublic,
		list.id,
		onOpenChange,
		router,
		togglingPrivacy,
	]);

	const handleDeleteList = useCallback(async () => {
		if (isFavoritesList || deleting) return;
		setDeleting(true);
		try {
			const res = await api.api.lists({ id: list.id }).delete();
			if (res.error) {
				toast.error("Couldn't delete list");
				return;
			}
			toast.success("List deleted");
			setDeleteConfirmOpen(false);
			onOpenChange(false);
			router.refresh();
		} catch {
			toast.error("Couldn't delete list");
		} finally {
			setDeleting(false);
		}
	}, [deleting, isFavoritesList, list.id, onOpenChange, router]);

	const handleCoverFile = useCallback(
		async (file: File | undefined) => {
			if (!file || uploadingCover) return;
			if (!file.type.startsWith("image/")) {
				toast.error("Choose an image file");
				return;
			}
			if (file.size > 5_000_000) {
				toast.error("Image must be 5MB or smaller");
				return;
			}
			setUploadingCover(true);
			try {
				const coverImageUrl = await uploadListCover(list.id, file);
				const nextPoster = resolveListCoverImageSrc(
					list.id,
					coverImageUrl,
					Date.now(),
				);
				if (nextPoster) setDisplayPosterUrl(nextPoster);
				toast.success("Cover updated");
				router.refresh();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Couldn't upload cover",
				);
			} finally {
				setUploadingCover(false);
				if (coverInputRef.current) coverInputRef.current.value = "";
			}
		},
		[list.id, router, uploadingCover],
	);

	const openCoverFilePicker = useCallback(() => {
		onOpenChange(false);
		// Defer so the radial overlay unmounts before the native file dialog opens.
		window.requestAnimationFrame(() => {
			coverInputRef.current?.click();
		});
	}, [onOpenChange]);

	const radialItems = useMemo((): RadialToolkitItem[] => {
		const items: RadialToolkitItem[] = [
			{
				id: "open",
				label: "Open list",
				shortcut: "O",
				icon: <IconOpenExternalFill className="opacity-90" aria-hidden />,
				onSelect: () => {
					onOpenChange(false);
					router.push(listHref);
				},
			},
			{
				id: "copy",
				label: "Copy link",
				shortcut: "C",
				icon: <IconLinkFill className="opacity-90" aria-hidden />,
				onSelect: () => void handleCopyLink(),
			},
		];

		if (!isSharedList) {
			items.push({
				id: "cover",
				label: "Change cover",
				shortcut: "V",
				disabled: uploadingCover,
				icon: <IconCloneImageDashedFill className="opacity-90" aria-hidden />,
				onSelect: openCoverFilePicker,
			});
		}

		if (!isFavoritesList && !isSharedList) {
			items.push(
				{
					id: "edit",
					label: "Edit list",
					shortcut: "E",
					icon: <IconPen2Fill className="opacity-90" aria-hidden />,
					onSelect: () => {
						onOpenChange(false);
						setEditOpen(true);
					},
				},
				{
					id: "privacy",
					label: isPublic ? "Make private" : "Make public",
					shortcut: "P",
					disabled: togglingPrivacy,
					icon: isPublic ? (
						<IconLockFill className="opacity-90" aria-hidden />
					) : (
						<IconGlobePointerFill className="opacity-90" aria-hidden />
					),
					onSelect: () => void handleTogglePrivacy(),
				},
				{
					id: "delete",
					label: "Delete list",
					shortcut: "D",
					variant: "destructive",
					disabled: deleting,
					icon: <IconTrashXmarkFill className="opacity-90" aria-hidden />,
					onSelect: () => {
						onOpenChange(false);
						setDeleteConfirmOpen(true);
					},
				},
			);
		}

		return items;
	}, [
		deleting,
		handleCopyLink,
		handleTogglePrivacy,
		isFavoritesList,
		isSharedList,
		isPublic,
		listHref,
		onOpenChange,
		openCoverFilePicker,
		router,
		togglingPrivacy,
		uploadingCover,
	]);

	return (
		<>
			<Link
				href={listHref}
				className={shellClassName}
				aria-label={`${displayTitle} — ${metaLine}, ${likesLine}`}
				onContextMenu={onContextMenu}
				onPointerDown={onPointerDown}
			>
				<div className={frameShellClassName}>
					{displayPosterUrl ? (
						<Image
							src={displayPosterUrl}
							alt=""
							fill
							sizes={imageSizes}
							className="object-cover"
							priority={priority}
							unoptimized={isListCoverProxySrc(displayPosterUrl)}
						/>
					) : (
						<div className="grid size-full place-items-center p-3">
							<span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-desert-orange shadow-sm">
								<IconListPlay className="block size-4 shrink-0" aria-hidden />
							</span>
						</div>
					)}
					{/* Likes pill — top-right only; bottom scrim is title + meta (no duplicate heart row). */}
					{list.likesCount > 0 ? (
						<span className="pointer-events-none absolute top-3 right-3 z-10 inline-flex min-h-6 items-center gap-1 rounded-full bg-card/90 px-2 py-1 font-medium text-[10px] text-foreground tabular-nums shadow-sm">
							<IconHeartFilled
								className="size-2.5 shrink-0 text-desert-orange"
								aria-hidden
							/>
							{list.likesCount}
						</span>
					) : null}
					<div
						className={cn(
							"pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-linear-to-t from-card/95 via-card/55 to-transparent px-3 pb-3.5 text-center sm:px-4 sm:pb-4",
							displayPosterUrl ? "pt-12" : "pt-8",
						)}
					>
						<p className="line-clamp-2 max-w-[92%] font-medium text-foreground text-xs leading-snug sm:text-sm">
							{displayTitle}
						</p>
						<p className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-1.5 text-[10px] text-muted-foreground tabular-nums">
							<span>{metaLine}</span>
							{isSharedList ? (
								<span className="inline-flex items-center gap-0.5 rounded-full bg-background/80 px-1.5 py-0.5 font-medium uppercase tracking-wide">
									Shared
								</span>
							) : null}
							{!isPublic && !isSharedList ? (
								<span className="inline-flex items-center gap-0.5 rounded-full bg-background/80 px-1.5 py-0.5 font-medium uppercase tracking-wide">
									<IconLockFill className="size-2.5" aria-hidden />
									Private
								</span>
							) : null}
							{isSharedList && list.ownerHandle ? (
								<span className="truncate">@{list.ownerHandle}</span>
							) : null}
						</p>
					</div>
				</div>
			</Link>

			<input
				ref={coverInputRef}
				id={coverInputId}
				type="file"
				accept="image/*"
				className="sr-only"
				tabIndex={-1}
				aria-hidden
				onChange={(event) => {
					const file = event.target.files?.[0];
					void handleCoverFile(file);
				}}
			/>

			<RadialToolkit
				open={open}
				anchor={anchor}
				onOpenChange={onOpenChange}
				items={radialItems}
				title={`Actions for ${displayTitle}`}
			/>

			{!isFavoritesList ? (
				<>
					<ListLobbyEditDialog
						open={editOpen}
						onOpenChange={setEditOpen}
						listId={list.id}
						initialTitle={displayTitle}
						initialDescription={displayDescription}
						onSaved={({ title, description }) => {
							setDisplayTitle(title);
							setDisplayDescription(description);
							router.refresh();
						}}
					/>
					<ListLobbyDeleteConfirmDialog
						open={deleteConfirmOpen}
						listTitle={displayTitle}
						deleting={deleting}
						onCancel={() => setDeleteConfirmOpen(false)}
						onConfirm={() => void handleDeleteList()}
					/>
				</>
			) : null}
		</>
	);
}
