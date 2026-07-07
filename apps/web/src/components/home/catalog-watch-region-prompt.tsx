"use client";

import { Button } from "@still/ui/components/button";
import { Label } from "@still/ui/components/label";
import IconEarthPinFill from "@still/ui/icons/earth-pin-fill";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Drawer } from "vaul";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { StillPopoverSelect } from "@/components/ui/still-popover-select";
import { api } from "@/lib/api";
import {
	getAppMobileVaulServerSnapshot,
	getAppMobileVaulSnapshot,
	subscribeAppMobileVaul,
} from "@/lib/app-mobile-vaul";
import {
	APP_MODAL_OVERLAY_CLASS,
	APP_MODAL_POPOVER_POSITIONER_CLASS,
} from "@/lib/app-modal-layer";
import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME,
	MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME,
} from "@/lib/detail-vaul-drawer";
import { setWatchRegionPromptActive } from "@/lib/first-run-prompt-keys";
import { PROFILE_PREF_CATALOG_TMDB_WATCH_REGION } from "@/lib/profile-preferences";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const REGION_SELECT_OPTIONS = CATALOG_WATCH_REGION_OPTIONS.map(
	({ value, label }) => ({ value, label }),
);

/**
 * First-run prompt on `/home`: signed-in patrons who have not saved
 * `catalogTmdbWatchRegion` yet — same modal shell as list delete / account leave confirms.
 */
export function CatalogWatchRegionPrompt({ open }: { open: boolean }) {
	const reduceMotion = useReducedMotion();
	const isMobileVaul = useSyncExternalStore(
		subscribeAppMobileVaul,
		getAppMobileVaulSnapshot,
		getAppMobileVaulServerSnapshot,
	);
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);
	const [country, setCountry] = useState("US");
	const [pending, setPending] = useState<"ALL" | "country" | null>(null);
	/** Client dismiss — avoid `router.refresh()` on save (first `/home` RSC can error while prefs already persisted). */
	const [visible, setVisible] = useState(open);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (open) setVisible(true);
	}, [open]);

	useEffect(() => {
		if (!visible) return;
		setWatchRegionPromptActive(true);
		return () => setWatchRegionPromptActive(false);
	}, [visible]);

	useEffect(() => {
		if (!visible) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [visible]);

	async function persist(value: string, kind: "ALL" | "country") {
		setPending(kind);
		try {
			await api.api.profiles.me.patch({
				preferences: { [PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]: value },
			});
			toast.success(
				value === "ALL"
					? "Streaming catalogues will follow all regions."
					: "Catalogue region saved.",
			);
			setVisible(false);
		} catch (err) {
			console.error(err);
			toast.error("Could not save — try Account settings.");
		} finally {
			setPending(null);
		}
	}

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	if (!mounted) return null;

	const content = (
		<div
			className={cn(
				"flex min-h-0 flex-col items-center px-7 pt-10 text-center sm:px-9 sm:pt-12 sm:pb-12",
				isMobileVaul ? "pb-4" : "flex-1 pb-10",
			)}
		>
			<div
				className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-foreground sm:mb-8 sm:size-16"
				aria-hidden
			>
				<IconEarthPinFill className="opacity-90" size="28px" aria-hidden />
			</div>

			<h2
				id={titleId}
				className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
			>
				Streaming catalogue region
			</h2>
			<p
				id={descriptionId}
				className="mx-auto mt-3 w-full max-w-prose text-balance text-muted-foreground text-sm leading-tight sm:text-base"
			>
				“At home” rows use subscription streaming availability for a country or
				region. Pick where you subscribe, or choose all regions for a global
				slice. You can change this anytime in{" "}
				<Link
					href="/me/settings/catalogue"
					className="font-medium text-foreground underline-offset-4 hover:underline"
				>
					Settings
				</Link>
				.
			</p>

			<div className="mt-6 w-full max-w-xs space-y-2 text-left sm:mt-8">
				<Label
					htmlFor="catalog-watch-region-select"
					className="w-full justify-center text-center text-muted-foreground text-xs"
				>
					Country / region
				</Label>
				{isMobileVaul ? (
					// Native select inside Vaul avoids touch-scroll conflicts with custom popovers.
					<select
						id="catalog-watch-region-select"
						disabled={pending !== null}
						value={country}
						onChange={(event) => setCountry(event.target.value)}
						className="h-11 w-full rounded-2xl bg-background px-4 text-base text-foreground outline-none"
					>
						{REGION_SELECT_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				) : (
					<StillPopoverSelect
						id="catalog-watch-region-select"
						disabled={pending !== null}
						listAriaLabel="Streaming catalogue region"
						onChange={setCountry}
						options={REGION_SELECT_OPTIONS}
						placeholder="Choose a region"
						popoverPositionerClassName={APP_MODAL_POPOVER_POSITIONER_CLASS}
						popoverSide="bottom"
						value={country}
					/>
				)}
			</div>

			<div
				className={cn(
					"flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3 sm:pt-10",
					isMobileVaul ? "pt-5" : "mt-auto pt-8",
				)}
			>
				<DetailMotionButtonWrap>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						disabled={pending !== null}
						className={cn(
							"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-foreground sm:w-auto sm:min-w-34",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						onClick={() => void persist("ALL", "ALL")}
					>
						{pending === "ALL" ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : null}
						All regions
					</Button>
				</DetailMotionButtonWrap>
				<DetailMotionButtonWrap>
					<Button
						type="button"
						variant="default"
						size="pill"
						disabled={pending !== null}
						className="hover:!bg-foreground hover:!text-background h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background text-base sm:w-auto sm:min-w-34 [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
						onClick={() => void persist(country, "country")}
					>
						{pending === "country" ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : null}
						Save region
					</Button>
				</DetailMotionButtonWrap>
			</div>
		</div>
	);

	if (isMobileVaul) {
		return (
			<Drawer.Root
				open={visible}
				onOpenChange={setVisible}
				handleOnly
				shouldScaleBackground={false}
			>
				<Drawer.Portal>
					<Drawer.Overlay className="fixed inset-0 z-60 bg-absolute-black/82 backdrop-blur-sm" />
					<Drawer.Content
						data-still-detail-drawer=""
						className="fixed inset-x-0 bottom-0 z-60 flex max-h-[min(74svh,620px)] flex-col overflow-hidden rounded-t-[2.25rem] bg-card shadow-2xl outline-none"
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
						<Drawer.Title className="sr-only">
							Streaming catalogue region
						</Drawer.Title>
						<Drawer.Description className="sr-only">
							Pick your streaming catalogue region.
						</Drawer.Description>
						<div className="overflow-y-auto px-1 pb-1">{content}</div>
						<Drawer.Close className="sr-only">Close sheet</Drawer.Close>
					</Drawer.Content>
				</Drawer.Portal>
			</Drawer.Root>
		);
	}

	const portal = (
		<AnimatePresence>
			{visible ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={APP_MODAL_OVERLAY_CLASS}
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
						onClick={(event) => event.stopPropagation()}
						className={cn(
							"relative flex min-h-[22rem] w-full max-w-md flex-col overflow-visible rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:min-h-[24rem] sm:rounded-[2.25rem]",
						)}
					>
						{content}
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
