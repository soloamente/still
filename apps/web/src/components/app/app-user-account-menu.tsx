"use client";

import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@still/ui/components/dropdown-menu";
import IconAwardFill from "@still/ui/icons/award-fill";
import IconGear from "@still/ui/icons/gear";
import IconLockFill from "@still/ui/icons/lock-fill";
import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";

import { AccountMenuThemePicker } from "@/components/app/account-menu-theme-picker";
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
};

/**
 * Inset menu rows — 16px copy, generous horizontal padding.
 * Hover uses `bg-background` (canvas), not `bg-card`: popover and card share `--surface-raised`.
 */
export const accountMenuItemClassName = cn(
	"gap-2.5 rounded-[1.75rem] px-5 py-3 text-base text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
	"not-data-[variant=destructive]:focus:bg-background not-data-[variant=destructive]:focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground",
	"not-data-[variant=destructive]:[@media(hover:hover)]:hover:bg-background",
);

/** Primary destinations — same weight and inset rhythm as Log out (without destructive chrome). */
export const accountMenuPrimaryItemClassName = cn(
	accountMenuItemClassName,
	"font-semibold",
);

/** Rows inside a `bg-background` inset group — hover lifts to `bg-card` on the popover canvas. */
const accountMenuItemOnBackgroundClassName = cn(
	accountMenuItemClassName,
	"not-data-[variant=destructive]:focus:bg-card not-data-[variant=destructive]:focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground",
	"not-data-[variant=destructive]:[@media(hover:hover)]:hover:bg-card",
);

const accountMenuPrimaryOnBackgroundClassName = cn(
	accountMenuItemOnBackgroundClassName,
	"font-semibold",
);

/** Inset canvas block for grouped patron routes (replaces separator dividers). */
const accountMenuBackgroundGroupClassName =
	"rounded-[1.75rem] bg-background p-1.5";

/**
 * Floating menus — `bg-popover` (`--surface-overlay`) so panels read above page
 * `bg-card` catalogue shells without blending into the canvas.
 */
export const accountMenuContentClassName = cn(
	"!rounded-[2.5rem] w-[min(100vw-2rem,20rem)] min-w-[280px] max-w-[320px] overflow-hidden",
	"border-0 bg-popover px-4 pt-3 pb-4 text-base text-popover-foreground shadow-mobbin-xl ring-1 ring-foreground/10",
);

/**
 * Rich account dropdown body: identity block, primary patron routes, settings, log out.
 */
const STAFF_ROLES = ["owner", "admin", "moderator", "support"];

export function AppUserAccountMenuBody({ user }: AppUserAccountMenuBodyProps) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const isStaff = STAFF_ROLES.includes(session?.user?.role ?? "user");

	const go = (path: string) => {
		router.push(path);
	};

	const secondaryLine = user.email?.trim() || `@${user.handle}`;

	return (
		<>
			{/* Identity — avatar row, PRO chip, profile CTA on raised card (home / detail token rhythm). */}
			<div className="pt-1 pb-1">
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
						<div className="flex flex-col gap-0">
							<div className="flex flex-wrap items-center gap-2 leading-none">
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
								className="truncate text-muted-foreground text-sm leading-none"
								title={secondaryLine}
							>
								{secondaryLine}
							</p>
						</div>
					</div>
				</div>
				<button
					type="button"
					className={cn(
						"mt-4 w-full rounded-full bg-background py-3 font-medium text-foreground transition-colors duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					onClick={() => go(`/profile/${user.handle}`)}
				>
					View profile
				</button>
			</div>

			<div className={cn(accountMenuBackgroundGroupClassName, "mt-1")}>
				<AccountMenuThemePicker className="pb-1" isPro={Boolean(user.isPro)} />
				<DropdownMenuGroup className="p-0">
					<DropdownMenuItem
						className={accountMenuPrimaryOnBackgroundClassName}
						onClick={() => go("/achievements")}
					>
						<IconAwardFill size="20px" className="size-5 shrink-0 opacity-90" />
						Achievements
					</DropdownMenuItem>
					<DropdownMenuItem
						className={accountMenuItemOnBackgroundClassName}
						onClick={() => go("/me/settings")}
					>
						<IconGear size="20px" className="size-5 shrink-0 opacity-80" />
						Settings
					</DropdownMenuItem>
					{isStaff ? (
						<DropdownMenuItem
							className={accountMenuItemOnBackgroundClassName}
							onClick={() => go("/staff")}
						>
							<IconLockFill
								size="20px"
								className="size-5 shrink-0 opacity-80"
							/>
							Staff
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
			</div>

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
							"mailto:hello@still.app?subject=Sense%20support&body=How%20can%20we%20help%3F",
						)
					}
				>
					<span className="flex-1 text-left">Support</span>
					<ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
				</DropdownMenuItem>
			</DropdownMenuGroup> */}

			<DropdownMenuGroup className={cn("mt-2 p-0")}>
				<DropdownMenuItem
					className={cn(
						accountMenuItemClassName,
						"font-semibold",
						"justify-center bg-destructive/10 text-center data-[variant=destructive]:focus:bg-destructive/10",
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
							© {new Date().getFullYear()} Sense
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
							aria-label="Sense on X (opens in new tab)"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</Link>
				</div>
			</div> */}
		</>
	);
}
