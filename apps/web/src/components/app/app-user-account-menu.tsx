"use client";

import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@still/ui/components/dropdown-menu";
import { cn } from "@still/ui/lib/utils";
import {
	CirclePlus,
	MessageSquareText,
	Monitor,
	Moon,
	Settings,
	Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Session + profile fields needed for the Mobbin-style account surface (nav + home header). */
export type AccountMenuUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	/** Polar / billing hook — badge stays hidden until we wire subscription state. */
	isPro?: boolean;
};

type AppUserAccountMenuBodyProps = {
	user: AccountMenuUser;
	/** Opens universal search — “request a title” flows through discovery + chat. */
	onRequestContent?: () => void;
};

/** Inset menu rows — 16px copy, rounded hover wash inside popup padding (Track B / home search). */
export const accountMenuItemClassName = cn(
	"gap-2.5 rounded-[1.75rem] px-3 py-3 text-base text-foreground",
	"focus:bg-card focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground",
	"[@media(hover:hover)]:hover:bg-card/80",
);

/**
 * Floating menus — `bg-popover` (`--surface-overlay`) so panels read above page
 * `bg-card` catalogue shells without blending into the canvas.
 */
export const accountMenuContentClassName = cn(
	"!rounded-[2.5rem] w-[min(100vw-2rem,20rem)] min-w-[280px] max-w-[320px] overflow-hidden",
	"border-0 bg-popover px-4 pt-3 pb-4 text-base text-popover-foreground shadow-mobbin-xl ring-1 ring-foreground/10",
);

/**
 * Rich account dropdown body: identity block, quick actions, settings, theme
 * segment control, marketing links, and legal footer — matches the reference
 * layout the team picked for avatar menus.
 */
export function AppUserAccountMenuBody({
	user,
	onRequestContent,
}: AppUserAccountMenuBodyProps) {
	const router = useRouter();
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// `next-themes` reads `localStorage` after mount — avoid SSR/client theme mismatch on the segment.
	useEffect(() => {
		setMounted(true);
	}, []);

	const go = (path: string) => {
		router.push(path);
	};

	const openExternal = (href: string) => {
		window.open(href, "_blank", "noopener,noreferrer");
	};

	const secondaryLine = user.email?.trim() || `@${user.handle}`;

	return (
		<>
			{/* Identity — avatar row, PRO chip, profile CTA on raised card (home / detail token rhythm). */}
			<div className="pt-1 pb-3">
				<div className="flex items-start gap-3">
					<PatronPortraitAvatar
						handle={user.handle}
						avatarUrl={user.image}
						name={user.name}
						width={80}
						height={80}
						className="size-11 shrink-0 rounded-full text-[11px]"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<p
								className="truncate font-semibold text-base text-foreground"
								title={user.name}
							>
								{user.name || "Member"}
							</p>
							{user.isPro ? (
								<span className="rounded-full bg-foreground px-2 py-0.5 font-semibold text-[10px] text-background uppercase tracking-wide">
									Pro
								</span>
							) : null}
						</div>
						<p
							className="truncate text-muted-foreground text-sm"
							title={secondaryLine}
						>
							{secondaryLine}
						</p>
					</div>
				</div>
				<button
					type="button"
					className={cn(
						"mt-3 w-full rounded-full bg-background py-2.5 font-medium text-foreground text-sm shadow-sm transition-colors duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					onClick={() => go(`/profile/${user.handle}`)}
				>
					View profile
				</button>
			</div>

			<DropdownMenuSeparator className="my-2 h-px bg-border/50" />

			<DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className={accountMenuItemClassName}
					onClick={() => {
						if (onRequestContent) onRequestContent();
						else go("/chat");
					}}
				>
					<CirclePlus className="size-4 shrink-0 opacity-90" aria-hidden />
					Request feature
				</DropdownMenuItem>
				<DropdownMenuItem
					className={accountMenuItemClassName}
					onClick={() =>
						openExternal(
							"mailto:hello@still.app?subject=Still%20feedback&body=Tell%20us%20what%20you%20think…",
						)
					}
				>
					<MessageSquareText
						className="size-4 shrink-0 opacity-80"
						aria-hidden
					/>
					Give feedback
				</DropdownMenuItem>
			</DropdownMenuGroup>

			<DropdownMenuSeparator className="my-2 h-px bg-border/50" />

			<DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className={accountMenuItemClassName}
					onClick={() => go("/me/settings")}
				>
					<Settings className="size-4 shrink-0 opacity-80" aria-hidden />
					Settings
				</DropdownMenuItem>
			</DropdownMenuGroup>

			<DropdownMenuSeparator className="my-2 h-px bg-border/50" />

			{/* Theme — pill segment on `bg-card`, active option on `bg-background` (sticky browse chips). */}
			<div
				className="flex items-center justify-between gap-3 py-1"
				onPointerDown={(e) => e.stopPropagation()}
			>
				<span className="text-base text-foreground">Theme</span>
				<fieldset
					className="m-0 flex min-w-0 shrink-0 items-center gap-0.5 rounded-full bg-card p-0.5"
					aria-label="Color theme"
				>
					{(
						[
							{ id: "light" as const, icon: Sun, label: "Light theme" },
							{ id: "dark" as const, icon: Moon, label: "Dark theme" },
							{ id: "system" as const, icon: Monitor, label: "System theme" },
						] as const
					).map(({ id, icon: Icon, label }) => {
						const active = mounted && theme === id;
						return (
							<button
								key={id}
								type="button"
								aria-label={label}
								aria-pressed={active}
								className={cn(
									"flex size-9 items-center justify-center rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none",
									active
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
								)}
								onClick={() => setTheme(id)}
							>
								<Icon className="size-4" aria-hidden />
							</button>
						);
					})}
				</fieldset>
			</div>

			<DropdownMenuSeparator className="my-2 h-px bg-border/50" />

			{/* <DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className="rounded-none px-4 py-3.5 text-base"
					onClick={() => goHash("#pro")}
				>
					Pricing
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-none px-4 py-3.5 text-base"
					onClick={() => go("/news")}
				>
					Changelog
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-none px-4 py-3.5 text-base"
					onClick={() => goHash("#community")}
				>
					Blog
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-none px-4 py-3.5 text-base"
					onClick={() => openExternal("https://still.app")}
				>
					<span className="flex-1 text-left">Careers</span>
					<ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-none px-4 py-3.5 text-base"
					onClick={() => goHash("#pro")}
				>
					<span className="flex-1 text-left">Merch</span>
					<span className="mr-1 rounded bg-muted px-1.5 py-px font-medium text-[10px] text-muted-foreground">
						New
					</span>
					<ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-none px-4 py-3.5 text-base"
					onClick={() =>
						openExternal(
							"mailto:hello@still.app?subject=Still%20support&body=How%20can%20we%20help%3F",
						)
					}
				>
					<span className="flex-1 text-left">Support</span>
					<ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
				</DropdownMenuItem>
			</DropdownMenuGroup> */}

			<DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className={cn(
						accountMenuItemClassName,
						"font-semibold data-[variant=destructive]:focus:bg-destructive/10",
					)}
					variant="destructive"
					onClick={() =>
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									router.replace("/");
									router.refresh();
								},
							},
						})
					}
				>
					Log out
				</DropdownMenuItem>
			</DropdownMenuGroup>

			{/* Legal + social — compact footer row (borderless; separator above already divides the block). */}
			{/* <div className="px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
					<div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
						<Link
							href="/"
							className="[@media(hover:hover)]:hover:text-foreground"
						>
							Privacy
						</Link>
						<span aria-hidden className="text-border">
							·
						</span>
						<Link
							href="/"
							className="[@media(hover:hover)]:hover:text-foreground"
						>
							Terms
						</Link>
						<span aria-hidden className="text-border">
							·
						</span>
						<span className="tabular-nums">
							© {new Date().getFullYear()} Still
						</span>
					</div>
					<Link
						href="https://x.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-foreground [@media(hover:hover)]:hover:opacity-80"
					>
						<svg
							viewBox="0 0 24 24"
							className="size-4"
							fill="currentColor"
							role="img"
							aria-label="Still on X (opens in new tab)"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</Link>
				</div>
			</div> */}
		</>
	);
}
