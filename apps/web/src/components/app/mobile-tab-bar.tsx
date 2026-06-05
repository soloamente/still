"use client";

import { cn } from "@still/ui/lib/utils";
import { Bell, Home, Plus, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import { isActive, shouldHideMobileTabBar } from "@/components/app/mobile-nav";
import { MobileYouSheet } from "@/components/app/mobile-you-sheet";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
import { useDismissSheetOnRouteChange } from "@/lib/use-dismiss-sheet-on-route-change";

type TabUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
};

const itemClass =
	"relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 font-medium text-[10px] transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

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

	const pip = (
		<motion.span
			layoutId="mobile-nav-active-pip"
			className="absolute inset-x-3 -top-0.5 h-0.5 rounded-full bg-accent"
			transition={
				reduceMotion
					? { duration: 0 }
					: { type: "tween", duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }
			}
		/>
	);

	return (
		<>
			<nav
				aria-label="Primary"
				className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center md:hidden"
			>
				<div className="pointer-events-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] flex w-full max-w-md items-center justify-around gap-1 rounded-full border border-white/6 bg-surface-raised/72 px-2 py-1.5 shadow-[0_10px_36px_rgba(6,6,10,0.42)] backdrop-blur-xl">
					{/* Home */}
					<Link
						href="/home"
						aria-current={homeActive ? "page" : undefined}
						className={cn(
							itemClass,
							homeActive ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{homeActive ? pip : null}
						<Home className="size-5" aria-hidden />
						Home
					</Link>

					{/* Search */}
					<button
						type="button"
						className={cn(itemClass, "text-muted-foreground")}
						onClick={() => requestCatalogSearch()}
						aria-label="Search films, TV, and people"
					>
						<Search className="size-5" aria-hidden />
						Search
					</button>

					{/* Center: Log */}
					<button
						type="button"
						className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_8px_20px_rgba(224,179,65,0.45)] transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95"
						onClick={() => openQuickLog()}
						aria-label="Log a film"
					>
						<Plus className="size-7" aria-hidden />
					</button>

					{/* Inbox */}
					<Link
						href="/notifications"
						aria-current={inboxActive ? "page" : undefined}
						className={cn(
							itemClass,
							inboxActive ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{inboxActive ? pip : null}
						<Bell className="size-5" aria-hidden />
						Inbox
					</Link>

					{/* You */}
					<button
						type="button"
						className={cn(
							itemClass,
							youOpen ? "text-foreground" : "text-muted-foreground",
						)}
						onClick={() => setYouOpen(true)}
						aria-haspopup="dialog"
						aria-expanded={youOpen}
						aria-label="Your account and destinations"
					>
						<span className="flex size-5 items-center justify-center">
							<NavUserAvatar
								src={user.image}
								name={user.name}
								handle={user.handle}
								size="compact"
							/>
						</span>
						You
					</button>
				</div>
			</nav>

			<MobileYouSheet
				open={youOpen}
				onClose={() => setYouOpen(false)}
				user={user}
			/>
		</>
	);
}
