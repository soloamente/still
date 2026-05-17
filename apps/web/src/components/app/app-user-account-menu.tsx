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

import { authClient } from "@/lib/auth-client";

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
			{/* Identity — PRO chip, name, email/handle, primary profile CTA (no hairline border; separators below handle rhythm). */}
			<div className="pt-3 pb-4">
				<div className="flex flex-wrap items-center gap-2">
					{user.isPro ? (
						<span className="rounded-full bg-foreground px-2 py-0.5 font-semibold text-[10px] text-background uppercase tracking-wide">
							Pro
						</span>
					) : null}
				</div>
				<p
					className="mt-2 truncate font-semibold text-base text-foreground"
					title={user.name}
				>
					{user.name || "Member"}
				</p>
				<p
					className="truncate text-base text-muted-foreground"
					title={secondaryLine}
				>
					{secondaryLine}
				</p>
				<button
					type="button"
					className="mt-3 w-full rounded-full bg-card py-2.5 text-sm"
					onClick={() => go(`/profile/${user.handle}`)}
				>
					View profile
				</button>
			</div>

			<DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className="rounded-none px-0 py-3 text-base hover:text-foreground focus:bg-card"
					onClick={() => {
						if (onRequestContent) onRequestContent();
						else go("/chat");
					}}
				>
					<CirclePlus className="size-4" aria-hidden />
					Request feature
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-none px-0 py-3 text-base"
					onClick={() =>
						openExternal(
							"mailto:hello@still.app?subject=Still%20feedback&body=Tell%20us%20what%20you%20think…",
						)
					}
				>
					<MessageSquareText className="size-4 opacity-80" aria-hidden />
					Give feedback
				</DropdownMenuItem>
			</DropdownMenuGroup>

			<DropdownMenuSeparator className="-mx-4 my-0" />

			<DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className="rounded-none px-0 py-3.5 text-base"
					onClick={() => go("/me/settings")}
				>
					<Settings className="size-4 opacity-80" aria-hidden />
					Settings
				</DropdownMenuItem>
			</DropdownMenuGroup>

			<DropdownMenuSeparator className="-mx-4 my-0" />

			{/* Theme — segmented control (light / dark / system) */}
			<div
				className="flex items-center justify-between gap-3 py-3.5"
				// Keep clicks inside this toolbar from being treated as “outside” dismiss targets where possible.
				onPointerDown={(e) => e.stopPropagation()}
			>
				<span className="text-base text-foreground">Theme</span>
				<fieldset
					className="m-0 flex min-w-0 shrink-0 items-center gap-0.5 rounded-full border-0 p-0.5"
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
									"relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
									"[@media(hover:hover)]:hover:text-foreground",
									active && "text-foreground",
								)}
								onClick={() => setTheme(id)}
							>
								{active ? (
									<span
										className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-foreground/90 ring-offset-0"
										aria-hidden
									/>
								) : null}
								<Icon className="relative z-1 size-4" />
							</button>
						);
					})}
				</fieldset>
			</div>

			<DropdownMenuSeparator className="-mx-4 my-0 bg-border/60" />

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

			<DropdownMenuSeparator className="-mx-4 my-0" />

			<DropdownMenuGroup className="p-0">
				<DropdownMenuItem
					className="rounded-none px-0 py-3.5 font-semibold text-base"
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

/** Shared panel chrome for both avatar menus — wide card, no default item padding bleed. */
export const accountMenuContentClassName =
	// Frosted sheet: darker neutral (lower L than before) + alpha so the page still blurs through.
	// `text-base` = 16px body copy for the whole sheet (items default to `text-xs` in `@still/ui` dropdown primitives).
	// Horizontal padding lives on the popup so menu rows (focus/hover backgrounds) inset from the rounded shell;
	// separators use `-mx-4` in the body to cancel this and stay edge-to-edge.
	"min-w-[280px] max-w-[320px] w-[min(100vw-2rem,10rem)] overflow-hidden rounded-3xl border-0 bg-[oklch(0.38_0_0/0.55)] px-4 pb-3 text-base text-popover-foreground ring-0 backdrop-blur-xl";
