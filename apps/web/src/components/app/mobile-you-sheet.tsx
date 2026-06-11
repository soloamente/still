"use client";

import IconAwardFill from "@still/ui/icons/award-fill";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconGear from "@still/ui/icons/gear";
import IconListPlay from "@still/ui/icons/list-play";
import IconPlaylistOutline from "@still/ui/icons/playlist-outline";
import IconTicket from "@still/ui/icons/ticket";
import IconTicketFilled from "@still/ui/icons/ticket-filled";
import { cn } from "@still/ui/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useRef } from "react";

import { AccountMenuThemePicker } from "@/components/app/account-menu-theme-picker";
import { MOBILE_YOU_DESTINATIONS } from "@/components/app/mobile-nav";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { authClient } from "@/lib/auth-client";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

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

const DESTINATION_ICON_CLASS = "size-5 shrink-0 opacity-80";

function renderDestinationLeadingIcon(
	href: string,
	pathname: string,
): ReactNode {
	if (href === "/achievements") {
		return <IconAwardFill size="20px" className="size-5 shrink-0 opacity-90" />;
	}

	switch (href) {
		case "/diary":
			return pathname === "/diary" || pathname.startsWith("/diary/") ? (
				<IconTicketFilled
					size="20px"
					className={DESTINATION_ICON_CLASS}
					aria-hidden
				/>
			) : (
				<IconTicket
					size="20px"
					className={DESTINATION_ICON_CLASS}
					aria-hidden
				/>
			);
		case "/watchlist":
			return (
				<IconClockRotateClockwise
					size="20px"
					className={DESTINATION_ICON_CLASS}
					aria-hidden
				/>
			);
		case "/lists":
			return pathname === "/lists" || pathname.startsWith("/lists/") ? (
				<IconListPlay
					size="18px"
					className={DESTINATION_ICON_CLASS}
					aria-hidden
				/>
			) : (
				<IconPlaylistOutline
					size="18px"
					className={DESTINATION_ICON_CLASS}
					aria-hidden
				/>
			);
		default:
			return null;
	}
}

/** Inset row on `bg-background` groups — hover lifts to `bg-card` on the drawer canvas. */
const rowClass = cn(
	"flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base text-foreground",
	"transition-colors duration-200 ease-out motion-reduce:transition-none",
	"[@media(hover:hover)]:hover:bg-card",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

const insetGroupClassName = "rounded-[1.75rem] bg-background p-1.5";

/**
 * Mobile tab bar "You" menu — real Vaul drawer (not a motion overlay) with drag handle
 * and scroll scrims, stacked above the tab bar via `appStack`.
 */
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
	const pathname = usePathname();
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		user.handle,
	);

	const go = (path: string) => {
		onClose();
		router.push(path);
	};

	const secondaryLine = user.email?.trim() || `@${user.handle}`;

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			appStack
			title="Your account and destinations"
			description="Profile, diary, watchlist, settings, and sign out"
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-xl pb-[max(2.5rem,env(safe-area-inset-bottom))]">
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
								"transition-transform duration-200 active:scale-[0.98] motion-reduce:active:scale-100",
							)}
							onClick={() => go(`/profile/${user.handle}`)}
						>
							View profile
						</button>

						{/* Destinations */}
						<div className={cn("mt-3", insetGroupClassName)}>
							{MOBILE_YOU_DESTINATIONS.map((d) => (
								<button
									key={d.href}
									type="button"
									className={rowClass}
									onClick={() => go(d.href)}
								>
									{renderDestinationLeadingIcon(d.href, pathname)}
									{d.label}
								</button>
							))}
						</div>

						{/* Theme + settings */}
						<div className={cn("mt-3", insetGroupClassName)}>
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
								"mt-3 justify-center rounded-[1.75rem] bg-destructive/10 text-center font-medium text-destructive",
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
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="filmography"
				/>
			</div>
		</DetailVaulSheet>
	);
}
