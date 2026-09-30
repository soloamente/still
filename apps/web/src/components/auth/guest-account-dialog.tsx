"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type ReactNode,
	Suspense,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { isAccountRequiredPath } from "@/lib/guest-browse-paths";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

type GuestAccountDialogStore = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
};

const useGuestAccountDialogStore = create<GuestAccountDialogStore>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
}));

/** Open the shared guest account dialog from any signed-out surface. */
export function openGuestAccountDialog(): void {
	useGuestAccountDialogStore.getState().open();
}

/**
 * Build the auth `from` value for the page still on screen.
 * Drops `account` so a cold `/home?account=1` returns as `/home`.
 */
export function guestAuthReturnPath(pathname: string, search: string): string {
	const raw = search.startsWith("?") ? search.slice(1) : search;
	const params = new URLSearchParams(raw);
	params.delete("account");
	const query = params.toString();
	return query ? `${pathname}?${query}` : pathname;
}

function GuestAccountDialogPanel({
	open,
	onClose,
	fromPath,
}: {
	open: boolean;
	onClose: () => void;
	fromPath: string;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	const encodedFrom = encodeURIComponent(fromPath);
	const signInHref = `/sign-in?from=${encodedFrom}`;
	const signUpHref = `/sign-up?from=${encodedFrom}`;

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					key="guest-account-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					className={cn(APP_MODAL_OVERLAY_CLASS, "px-4 py-8")}
					onClick={onClose}
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
						className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-card text-foreground sm:rounded-[2.25rem]"
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onClose}
								aria-label="Close"
								className={cn(
									"rounded-full bg-background text-muted-foreground",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex flex-col items-center px-7 pt-10 pb-10 text-center sm:px-9 sm:pt-12 sm:pb-12">
							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								Account needed
							</h2>
							<p
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base"
							>
								Sign in or create a free account to use personal Sense features.
							</p>

							<div className="mt-8 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										nativeButton={false}
										render={<Link href={signInHref} />}
										className={cn(
											"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-muted-foreground sm:w-auto sm:min-w-34",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={onClose}
									>
										Log in
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										nativeButton={false}
										render={<Link href={signUpHref} />}
										className="hover:!bg-foreground hover:!text-background h-auto min-h-11 w-full bg-foreground px-5 py-2.5 font-semibold text-background text-base sm:w-auto sm:min-w-34"
										onClick={onClose}
									>
										Create account
									</Button>
								</DetailMotionButtonWrap>
							</div>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

/**
 * Guest chrome: account dialog, cold `?account=1` open, and cancel of
 * in-app navigation to personal routes.
 */
function GuestAccountProviderInner({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { isOpen, open, close } = useGuestAccountDialogStore();
	// Only strip `account=1` after the guest closes — keep the query while open.
	const openedFromAccountQueryRef = useRef(false);

	const fromPath = guestAuthReturnPath(
		pathname,
		searchParams.toString() ? `?${searchParams.toString()}` : "",
	);

	const handleClose = useCallback(() => {
		close();
		if (
			pathname === "/home" &&
			(searchParams.get("account") === "1" || openedFromAccountQueryRef.current)
		) {
			openedFromAccountQueryRef.current = false;
			router.replace("/home");
		}
	}, [close, pathname, router, searchParams]);

	// Cold personal URL → proxy sends `/home?account=1`; open once for that query.
	useEffect(() => {
		if (pathname !== "/home") return;
		if (searchParams.get("account") !== "1") return;
		if (openedFromAccountQueryRef.current) return;
		openedFromAccountQueryRef.current = true;
		open();
	}, [pathname, searchParams, open]);

	// Cancel in-app clicks to personal routes; keep the current URL.
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented) return;
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest("a");
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (anchor.target === "_blank") return;
			const href = anchor.getAttribute("href");
			if (!href || href.startsWith("#")) return;
			let url: URL;
			try {
				url = new URL(href, window.location.origin);
			} catch {
				return;
			}
			if (url.origin !== window.location.origin) return;
			if (!isAccountRequiredPath(url.pathname)) return;
			event.preventDefault();
			event.stopPropagation();
			open();
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [open]);

	return (
		<>
			{children}
			<GuestAccountDialogPanel
				open={isOpen}
				onClose={handleClose}
				fromPath={fromPath}
			/>
		</>
	);
}

/** Wrap guest browse + public share shells so the dialog and link gate work. */
export function GuestAccountProvider({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={children}>
			<GuestAccountProviderInner>{children}</GuestAccountProviderInner>
		</Suspense>
	);
}
