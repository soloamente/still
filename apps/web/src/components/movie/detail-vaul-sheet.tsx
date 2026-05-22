"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";

import {
	MOVIE_DETAIL_DRAWER_BODY_CLASSNAME,
	MOVIE_DETAIL_DRAWER_CONTENT_CLASSNAME,
	MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME,
	MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME,
	MOVIE_DETAIL_NESTED_DRAWER_CONTENT_CLASSNAME,
} from "@/lib/detail-vaul-drawer";
import { useLockDrawerScroll } from "@/lib/use-lock-drawer-scroll";

const OVERLAY_CLASSNAME =
	"fixed inset-0 z-50 bg-absolute-black/82 backdrop-blur-sm";
const NESTED_OVERLAY_CLASSNAME = "fixed inset-0 z-60 bg-absolute-black/50";

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
	scrollLock = open,
	trigger,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	nested?: boolean;
	/** When nested opens on top of a parent sheet, keep Lenis locked for either. */
	scrollLock?: boolean;
	trigger?: ReactNode;
	children: ReactNode;
}) {
	useLockDrawerScroll(scrollLock ?? open);

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
				<Drawer.Overlay
					className={nested ? NESTED_OVERLAY_CLASSNAME : OVERLAY_CLASSNAME}
				/>
				<Drawer.Content
					data-still-detail-drawer=""
					className={
						nested
							? MOVIE_DETAIL_NESTED_DRAWER_CONTENT_CLASSNAME
							: MOVIE_DETAIL_DRAWER_CONTENT_CLASSNAME
					}
				>
					<Drawer.Handle
						className={MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME}
						aria-label="Drag sheet"
					>
						<span
							className={MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME}
							aria-hidden
						/>
					</Drawer.Handle>
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
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children: ReactNode;
}) {
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
					<Drawer.Handle
						className={MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME}
						aria-label="Drag sheet"
					>
						<span
							className={MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME}
							aria-hidden
						/>
					</Drawer.Handle>
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
