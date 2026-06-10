"use client";

import IconAwardFill from "@still/ui/icons/award-fill";
import IconGear from "@still/ui/icons/gear";
import { cn } from "@still/ui/lib/utils";
import {
	BookMarked,
	Library,
	ListMusic,
	type LucideIcon,
	MessageCircle,
	Newspaper,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AccountMenuThemePicker } from "@/components/app/account-menu-theme-picker";
import { MOBILE_YOU_DESTINATIONS } from "@/components/app/mobile-nav";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { authClient } from "@/lib/auth-client";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";

type YouUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
};

/** Icon per destination href (kept out of the pure helper module). */
const DESTINATION_ICON: Record<string, LucideIcon> = {
	"/diary": BookMarked,
	"/watchlist": ListMusic,
	"/lists": Library,
	"/news": Newspaper,
	"/chat": MessageCircle,
};

const rowClass = cn(
	"flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base text-foreground",
	"transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-background",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

export function MobileYouSheet({
	open,
	onClose,
	user,
}: {
	open: boolean;
	onClose: () => void;
	user: YouUser;
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();

	// Close on Escape while open.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const go = (path: string) => {
		onClose();
		router.push(path);
	};

	const secondaryLine = user.email?.trim() || `@${user.handle}`;

	return (
		<AnimatePresence>
			{open ? (
				<motion.div
					className="fixed inset-0 z-[60] md:hidden"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
				>
					{/* Backdrop */}
					<button
						type="button"
						aria-label="Close menu"
						className="absolute inset-0 bg-black/55 backdrop-blur-sm"
						onClick={onClose}
					/>
					{/* Panel */}
					<motion.div
						role="dialog"
						aria-label="Your account and destinations"
						aria-modal="true"
						className={cn(
							"absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-[2rem]",
							"border-white/8 border-t bg-popover px-4 pt-3 text-popover-foreground",
							"pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(6,6,10,0.5)]",
						)}
						initial={{ y: reduceMotion ? 0 : "100%" }}
						animate={{ y: 0 }}
						exit={{ y: reduceMotion ? 0 : "100%" }}
						transition={
							reduceMotion
								? { duration: 0 }
								: { type: "tween", duration: 0.24, ease: [0.32, 0.72, 0, 1] }
						}
					>
						<div
							className="mx-auto mb-3 h-1 w-9 rounded-full bg-foreground/15"
							aria-hidden
						/>

						{/* Identity */}
						<div className="flex items-center gap-3 px-1 pb-1">
							<NavUserAvatar
								src={user.image}
								name={user.name}
								handle={user.handle}
								isAnimated={user.avatarIsAnimated ?? false}
								diaryMetalTier={user.diaryMetalTier ?? null}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold text-base text-foreground">
									{user.name || "Member"}
								</p>
								<p className="truncate text-muted-foreground text-sm">
									{secondaryLine}
								</p>
							</div>
						</div>
						<button
							type="button"
							className={cn(
								"mt-3 w-full rounded-full bg-background py-3 text-center font-medium text-foreground",
								"transition-transform duration-200 active:scale-[0.98]",
							)}
							onClick={() => go(`/profile/${user.handle}`)}
						>
							View profile
						</button>

						{/* Destinations */}
						<div className="mt-3 rounded-3xl bg-background/60 p-1.5">
							{MOBILE_YOU_DESTINATIONS.map((d) => {
								const Icon =
									d.href === "/achievements" ? null : DESTINATION_ICON[d.href];
								return (
									<button
										key={d.href}
										type="button"
										className={rowClass}
										onClick={() => go(d.href)}
									>
										{d.href === "/achievements" ? (
											<IconAwardFill
												size="20px"
												className="size-5 shrink-0 opacity-90"
											/>
										) : Icon ? (
											<Icon
												className="size-5 shrink-0 opacity-80"
												aria-hidden
											/>
										) : null}
										{d.label}
									</button>
								);
							})}
						</div>

						{/* Theme + settings + logout */}
						<div className="mt-3 rounded-3xl bg-background/60 p-1.5">
							<AccountMenuThemePicker
								className="pb-1"
								isPro={Boolean(user.isPro)}
							/>
							<button
								type="button"
								className={rowClass}
								onClick={() => go("/me/settings")}
							>
								<IconGear size="20px" className="size-5 shrink-0 opacity-80" />
								Settings
							</button>
						</div>

						<button
							type="button"
							className={cn(
								rowClass,
								"mt-3 justify-center bg-destructive/10 text-center font-medium text-destructive",
							)}
							onClick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											onClose();
											router.replace("/");
											router.refresh();
										},
									},
								})
							}
						>
							Log out
						</button>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
