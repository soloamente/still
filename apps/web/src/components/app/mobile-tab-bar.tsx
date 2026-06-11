"use client";

import { cn } from "@still/ui/lib/utils";
import { Bell, Home, Plus, Search } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";

import { isActive, shouldHideMobileTabBar } from "@/components/app/mobile-nav";
import { MobileYouSheet } from "@/components/app/mobile-you-sheet";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
import { DETAIL_MOTION_PRESSABLE_CLASS } from "@/lib/detail-action-motion";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { useDismissSheetOnRouteChange } from "@/lib/use-dismiss-sheet-on-route-change";

type TabUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
};

/** Shared tap target — icon-only; label stays available to screen readers. */
const tabSlotClass =
	"relative flex size-10 shrink-0 items-center justify-center rounded-full font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function MobileTabSlot({
	active,
	label,
	children,
	className,
	reduceMotion,
}: {
	active: boolean;
	label: string;
	children: ReactNode;
	className?: string;
	reduceMotion: boolean | null;
}) {
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	return (
		<span
			className={cn(
				tabSlotClass,
				active
					? "text-foreground"
					: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
				className,
			)}
		>
			{active ? (
				<motion.span
					layoutId="mobile-tab-bar-active-pill"
					className="absolute inset-0 rounded-full bg-card"
					transition={pillTransition}
				/>
			) : null}
			<span className="relative z-10 flex items-center justify-center">
				{children}
			</span>
			<span className="sr-only">{label}</span>
		</span>
	);
}

export function MobileTabBar({ user }: { user: TabUser }) {
	const pathname = usePathname();
	const reduceMotion = useReducedMotion();
	const requestCatalogSearch = useCatalogSearchDialog((s) => s.requestOpen);
	const openQuickLog = useQuickLog((s) => s.open);
	const [youOpen, setYouOpen] = useState(false);
	const closeYouSheet = useCallback(() => setYouOpen(false), []);
	// Hub links navigate underneath — close the You sheet when the route changes.
	useDismissSheetOnRouteChange(youOpen, closeYouSheet);

	const homeActive = isActive(pathname, "/home");
	const inboxActive = isActive(pathname, "/notifications");

	// Leaf detail pages own their bottom action bar — don't stack the tab bar.
	if (shouldHideMobileTabBar(pathname)) return null;

	return (
		<>
			{/*
				Pill-sized fixed nav — no full-width pointer-events pass-through layer.
				Matches home chip track: `rounded-full bg-background p-1` + sliding `bg-card`.
			*/}
			<nav
				aria-label="Primary"
				className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(calc(100%-1.5rem),22rem)] -translate-x-1/2 md:hidden"
			>
				<LayoutGroup id="mobile-tab-bar">
					<div
						className="flex items-center justify-between gap-0.5 rounded-full bg-background p-1"
						role="toolbar"
					>
						{/* Home */}
						<Link
							href="/home"
							aria-current={homeActive ? "page" : undefined}
							aria-label="Home"
							className={DETAIL_MOTION_PRESSABLE_CLASS}
						>
							<MobileTabSlot
								active={homeActive}
								label="Home"
								reduceMotion={reduceMotion}
							>
								<Home className="size-5" aria-hidden />
							</MobileTabSlot>
						</Link>

						{/* Search */}
						<button
							type="button"
							className={DETAIL_MOTION_PRESSABLE_CLASS}
							onClick={() => requestCatalogSearch()}
							aria-label="Search films, TV, and people"
						>
							<MobileTabSlot
								active={false}
								label="Search"
								reduceMotion={reduceMotion}
							>
								<Search className="size-5" aria-hidden />
							</MobileTabSlot>
						</button>

						{/* Log — accent chip inline with the row (no floating lift). */}
						<button
							type="button"
							className={cn(
								"flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.96] motion-reduce:active:scale-100",
								DETAIL_MOTION_PRESSABLE_CLASS,
							)}
							onClick={() => openQuickLog()}
							aria-label="Log a film"
						>
							<Plus className="size-5" aria-hidden />
						</button>

						{/* Inbox */}
						<Link
							href="/notifications"
							aria-current={inboxActive ? "page" : undefined}
							aria-label="Inbox"
							className={DETAIL_MOTION_PRESSABLE_CLASS}
						>
							<MobileTabSlot
								active={inboxActive}
								label="Inbox"
								reduceMotion={reduceMotion}
							>
								<Bell className="size-5" aria-hidden />
							</MobileTabSlot>
						</Link>

						{/* You */}
						<button
							type="button"
							className={DETAIL_MOTION_PRESSABLE_CLASS}
							onClick={() => setYouOpen(true)}
							aria-haspopup="dialog"
							aria-expanded={youOpen}
							aria-label="Your account and destinations"
						>
							<MobileTabSlot
								active={youOpen}
								label="You"
								reduceMotion={reduceMotion}
							>
								<NavUserAvatar
									src={user.image}
									name={user.name}
									handle={user.handle}
									size="compact"
									isAnimated={user.avatarIsAnimated ?? false}
									diaryMetalTier={user.diaryMetalTier ?? null}
								/>
							</MobileTabSlot>
						</button>
					</div>
				</LayoutGroup>
			</nav>

			<MobileYouSheet
				open={youOpen}
				onClose={() => setYouOpen(false)}
				user={user}
			/>
		</>
	);
}
