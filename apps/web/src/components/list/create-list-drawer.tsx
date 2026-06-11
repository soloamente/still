"use client";

import { useRef } from "react";
import { create } from "zustand";

import {
	CreateListFormContent,
	CreateListSheetFooter,
	type CreateListSheetProps,
	resolveCreateListSeedMedia,
	useCreateListForm,
	useCreateListScrollFadesKey,
} from "@/components/list/create-list-form";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import type { AddToListMedia } from "@/lib/add-to-list-media";
import { useLockDrawerScroll } from "@/lib/use-lock-drawer-scroll";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

type CreateListDrawerArgs = Pick<
	CreateListSheetProps,
	"media" | "movieId" | "movieTitle" | "onCreated"
>;

type Store = {
	isOpen: boolean;
	args: CreateListDrawerArgs | null;
	open: (args?: CreateListDrawerArgs) => void;
	close: () => void;
};

export const useCreateListDrawer = create<Store>((set) => ({
	isOpen: false,
	args: null,
	open: (args) => set({ isOpen: true, args: args ?? null }),
	close: () => set({ isOpen: false, args: null }),
}));

/** Open the global create-list Vaul sheet — same pattern as `openPersonFilmography`. */
export function openCreateListDrawer(args?: CreateListDrawerArgs) {
	useCreateListDrawer.getState().open(args);
}

/** Mounted once in `AppShell`; lists and add-to-list open here on mobile. */
export function CreateListDrawerRoot() {
	const { isOpen, args, close } = useCreateListDrawer();
	const seedMedia = resolveCreateListSeedMedia(
		args?.media,
		args?.movieId,
		args?.movieTitle,
	);

	useLockDrawerScroll(isOpen);

	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			appStack
			title="New list"
			description={
				seedMedia?.title
					? `${seedMedia.title} joins this list as soon as you create it.`
					: "Organize films and shows into a ranked or casual collection."
			}
		>
			{isOpen ? (
				<CreateListDrawerPanel
					active={isOpen}
					seedMedia={seedMedia}
					onClose={close}
					onCreated={args?.onCreated}
				/>
			) : null}
		</DetailVaulSheet>
	);
}

/**
 * Scrollable create-list body — mirrors {@link PersonFilmographyPanel} structure:
 * handle + scrollport + edge scrims; no modal overlay or dialog footer chrome.
 */
function CreateListDrawerPanel({
	active,
	seedMedia,
	onClose,
	onCreated,
}: {
	active: boolean;
	seedMedia: AddToListMedia | null;
	onClose: () => void;
	onCreated?: (listId: string) => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const form = useCreateListForm({
		open: active,
		onOpenChange: (open) => {
			if (!open) onClose();
		},
		seedMedia,
		onCreated,
	});

	const scrollFadesKey = useCreateListScrollFadesKey(
		form.description,
		form.isPublic,
		form.isRanked,
	);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		active,
		scrollFadesKey,
	);

	return (
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<DetailDrawerScrollBody scrollRef={scrollRef}>
				<div className="mx-auto w-full max-w-xl pt-2 pb-10">
					<header className="mx-auto mb-8 max-w-md text-center">
						<h2 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
							New list
						</h2>
						<p className="mt-2 text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
							{form.subtitle}
						</p>
					</header>

					<CreateListFormContent
						title={form.title}
						setTitle={form.setTitle}
						description={form.description}
						setDescription={form.setDescription}
						isPublic={form.isPublic}
						setIsPublic={form.setIsPublic}
						isRanked={form.isRanked}
						setIsRanked={form.setIsRanked}
						submit={form.submit}
						subtitle={form.subtitle}
						omitHeader
						pillLayoutSuffix="-drawer"
					/>

					<div className="mt-8">
						<CreateListSheetFooter
							variant="inline"
							saving={form.saving}
							canCreate={form.canCreate}
							onClose={form.handleClose}
						/>
					</div>
				</div>
			</DetailDrawerScrollBody>
			<SheetScrollScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
				footerTone="filmography"
			/>
		</div>
	);
}
