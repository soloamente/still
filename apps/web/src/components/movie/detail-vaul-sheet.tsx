"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { Drawer } from "vaul";
import {
	APP_DETAIL_DRAWER_CONTENT_CLASSNAME,
	MOVIE_DETAIL_DRAWER_BODY_CLASSNAME,
	MOVIE_DETAIL_DRAWER_CONTENT_CLASSNAME,
	MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME,
	MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME,
	MOVIE_DETAIL_NESTED_DRAWER_CONTENT_CLASSNAME,
} from "@/lib/detail-vaul-drawer";
import { useDismissSheetOnRouteChange } from "@/lib/use-dismiss-sheet-on-route-change";
import { useLockDrawerScroll } from "@/lib/use-lock-drawer-scroll";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/** Opaque scrim when blur would repaint the full viewport on software renderers. */
const OVERLAY_CLASSNAME_GPU =
	"fixed inset-0 z-50 bg-absolute-black/82 backdrop-blur-sm";
const OVERLAY_CLASSNAME_SOFTWARE = "fixed inset-0 z-50 bg-absolute-black/90";
const APP_OVERLAY_CLASSNAME_GPU =
	"fixed inset-0 z-[60] bg-absolute-black/82 backdrop-blur-sm";
const APP_OVERLAY_CLASSNAME_SOFTWARE =
	"fixed inset-0 z-[60] bg-absolute-black/90";
const NESTED_OVERLAY_CLASSNAME = "fixed inset-0 z-60 bg-absolute-black/50";

/** Drag rail with optional left/right chrome on the same row as the grip. */
function DetailVaulDrawerHandleRow({
	handleLeading,
	handleTrailing,
}: {
	handleLeading?: ReactNode;
	handleTrailing?: ReactNode;
}) {
	const hasAccessory = Boolean(handleLeading || handleTrailing);

	return (
		<div
			className={cn(
				"relative w-full shrink-0",
				// Extra inset when chrome shares the handle row — avoids flush top edge.
				hasAccessory && "pt-4 pb-2",
			)}
		>
			<Drawer.Handle
				className={cn(
					MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME,
					hasAccessory && "mt-0 min-h-12",
				)}
				aria-label="Drag sheet"
			>
				<span
					className={MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME}
					aria-hidden
				/>
			</Drawer.Handle>
			{hasAccessory ? (
				<div className="pointer-events-none absolute inset-0 grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-2 px-3 md:px-4 md:pt-3">
					<div className="pointer-events-auto min-w-0 justify-self-start">
						{handleLeading}
					</div>
					<div aria-hidden />
					<div className="pointer-events-auto flex justify-self-end">
						{handleTrailing}
					</div>
				</div>
			) : null}
		</div>
	);
}

/**
 * Vaul filmography / cast sheet — drag the handle to move or dismiss; scroll uses the
 * full sheet width (`data-vaul-no-drag` on the scrollport). Grip styling is ours only —
 * see `[data-still-detail-drawer] [data-vaul-handle]` in globals.css.
 */
export function DetailVaulSheet({
	open,
	onOpenChange,
	title,
	description,
	nested = false,
	/** App routes with tab bar — overlay + sheet at `z-[60]`. */
	appStack = false,
	scrollLock = open,
	trigger,
	/** Left slot aligned with the drag handle row (e.g. patron avatar in review reader). */
	handleLeading,
	/** Right slot aligned with the drag handle row (e.g. icon actions). */
	handleTrailing,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	nested?: boolean;
	appStack?: boolean;
	/** When nested opens on top of a parent sheet, keep Lenis locked for either. */
	scrollLock?: boolean;
	trigger?: ReactNode;
	handleLeading?: ReactNode;
	handleTrailing?: ReactNode;
	children: ReactNode;
}) {
	useLockDrawerScroll(scrollLock ?? open);
	const softwareGpu = useSoftwareGpuRendering();
	const overlayClassName = nested
		? NESTED_OVERLAY_CLASSNAME
		: appStack
			? softwareGpu
				? APP_OVERLAY_CLASSNAME_SOFTWARE
				: APP_OVERLAY_CLASSNAME_GPU
			: softwareGpu
				? OVERLAY_CLASSNAME_SOFTWARE
				: OVERLAY_CLASSNAME_GPU;

	const contentClassName = nested
		? MOVIE_DETAIL_NESTED_DRAWER_CONTENT_CLASSNAME
		: appStack
			? APP_DETAIL_DRAWER_CONTENT_CLASSNAME
			: MOVIE_DETAIL_DRAWER_CONTENT_CLASSNAME;

	const dismissOnNavigate = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);
	// Poster / profile taps inside the sheet navigate via Next `<Link>` — close on route change.
	useDismissSheetOnRouteChange(open, dismissOnNavigate);

	return (
		<Drawer.Root
			open={open}
			onOpenChange={onOpenChange}
			handleOnly
			shouldScaleBackground={false}
			nested={nested}
		>
			{trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
			<Drawer.Portal>
				<Drawer.Overlay className={overlayClassName} />
				<Drawer.Content
					data-still-detail-drawer=""
					className={contentClassName}
				>
					<DetailVaulDrawerHandleRow
						handleLeading={handleLeading}
						handleTrailing={handleTrailing}
					/>
					<Drawer.Title className="sr-only">{title}</Drawer.Title>
					{description ? (
						<Drawer.Description className="sr-only">
							{description}
						</Drawer.Description>
					) : null}
					<div className={MOVIE_DETAIL_DRAWER_BODY_CLASSNAME}>{children}</div>
					<Drawer.Close className="sr-only">Close sheet</Drawer.Close>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}

/** Nested filmography on top of cast & crew — must live inside parent `Drawer.Content`. */
export function DetailVaulNestedSheet({
	open,
	onOpenChange,
	title,
	description,
	handleLeading,
	handleTrailing,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	handleLeading?: ReactNode;
	handleTrailing?: ReactNode;
	children: ReactNode;
}) {
	const dismissOnNavigate = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);
	// Nested filmography links also navigate away — dismiss before the parent page swaps.
	useDismissSheetOnRouteChange(open, dismissOnNavigate);

	return (
		<Drawer.NestedRoot
			open={open}
			onOpenChange={onOpenChange}
			handleOnly
			shouldScaleBackground={false}
		>
			<Drawer.Portal>
				<Drawer.Overlay className={NESTED_OVERLAY_CLASSNAME} />
				<Drawer.Content
					data-still-detail-drawer=""
					className={MOVIE_DETAIL_NESTED_DRAWER_CONTENT_CLASSNAME}
				>
					<DetailVaulDrawerHandleRow
						handleLeading={handleLeading}
						handleTrailing={handleTrailing}
					/>
					<Drawer.Title className="sr-only">{title}</Drawer.Title>
					{description ? (
						<Drawer.Description className="sr-only">
							{description}
						</Drawer.Description>
					) : null}
					<div className={MOVIE_DETAIL_DRAWER_BODY_CLASSNAME}>{children}</div>
					<Drawer.Close className="sr-only">Close sheet</Drawer.Close>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.NestedRoot>
	);
}
