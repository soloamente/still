"use client";

import IconDiscordBrand from "@still/ui/icons/discord-brand";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { APP_NAME } from "@/lib/app-brand";
import {
	type DiscordLinkVisualState,
	discordLinkStatusCopy,
	formatAtHandle,
} from "@/lib/discord-link-status";

type MeDiscordLinkStatusProps = {
	state: DiscordLinkVisualState;
	handle: string;
	displayName: string;
	hasAvatar: boolean;
	/** Unique Discord username when linked — shown as `@name` under the mark. */
	discordUsername?: string | null;
	/** Trailing footer slot — Connect when idle, quiet Disconnect when linked. */
	footerAction?: ReactNode;
};

/** Dotted rail — live sheen travels from the endpoint toward the pill. */
function LinkConnector({
	live,
	paused,
	fadeTowardPill,
}: {
	live: boolean;
	paused: boolean;
	/** `leading` fades in from the Sense side; `trailing` from Discord. */
	fadeTowardPill: "leading" | "trailing";
}) {
	return (
		<div
			aria-hidden
			className={cn(
				"discord-link-flow",
				live && "is-live",
				paused && "is-paused",
			)}
			data-toward={fadeTowardPill}
		>
			<span className="discord-link-flow__track" />
			{live ? <span className="discord-link-flow__pulse" /> : null}
		</div>
	);
}

function EndpointTile({
	label,
	roleLabel,
	children,
}: {
	label: string;
	roleLabel: string;
	children: ReactNode;
}) {
	return (
		<div className="flex w-24 shrink-0 flex-col items-center gap-2 text-center sm:w-28">
			<div className="relative flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-background">
				{children}
			</div>
			<div className="min-w-0 space-y-1">
				<p className="truncate font-medium text-foreground text-sm">{label}</p>
				{roleLabel ? (
					<p className="truncate rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
						{roleLabel}
					</p>
				) : null}
			</div>
		</div>
	);
}

/**
 * Sense ↔ Discord connection diagram — reference-inspired status card.
 * Inset `bg-card` on the settings `bg-background` panel (no decorative border).
 */
export function MeDiscordLinkStatus({
	state,
	handle,
	displayName,
	hasAvatar,
	discordUsername,
	footerAction,
}: MeDiscordLinkStatusProps) {
	const copy = discordLinkStatusCopy(state);
	const live = state === "active" || state === "connected";
	const showCheck = live;
	const rootRef = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(true);

	// Pause the inward loop when the card leaves the viewport.
	useEffect(() => {
		const el = rootRef.current;
		if (!el || !live) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				setInView(entry?.isIntersecting === true);
			},
			{ threshold: 0.2 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [live]);

	return (
		<div ref={rootRef} className="discord-link-status rounded-2xl bg-card">
			<p className="sr-only">
				{copy.pill}. {copy.footer}
			</p>
			<div className="flex items-start justify-between gap-3 px-5 py-6 sm:px-6">
				<EndpointTile label={APP_NAME} roleLabel={formatAtHandle(handle)}>
					<PatronPortraitAvatar
						handle={handle}
						avatarUrl={hasAvatar ? "committed" : null}
						name={displayName || handle}
						width={48}
						height={48}
						className="size-full"
					/>
				</EndpointTile>

				<div className="flex min-w-0 flex-1 items-center self-center pt-0">
					<LinkConnector
						live={live}
						paused={!inView}
						fadeTowardPill="trailing"
					/>
					<p
						className={cn(
							"mx-2.5 shrink-0 rounded-full px-4 py-2 font-semibold text-sm",
							live
								? "bg-emerald-400 text-zinc-950"
								: "bg-background text-muted-foreground",
						)}
					>
						{copy.pill}
					</p>
					<LinkConnector
						live={live}
						paused={!inView}
						fadeTowardPill="leading"
					/>
				</div>

				<EndpointTile
					label="Discord"
					roleLabel={formatAtHandle(discordUsername)}
				>
					<IconDiscordBrand size={22} className="text-foreground" />
				</EndpointTile>
			</div>

			<div className="flex flex-col gap-3 px-5 pt-1 pb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<p
					className="inline-flex min-w-0 items-center gap-2 text-foreground text-sm"
					aria-live="polite"
				>
					{showCheck ? (
						<span
							className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-zinc-950"
							aria-hidden
						>
							<Check className="size-3 stroke-[2.5]" />
						</span>
					) : (
						<span
							className="inline-flex size-2.5 shrink-0 rounded-full bg-muted-foreground/35"
							aria-hidden
						/>
					)}
					<span className="text-pretty">{copy.footer}</span>
				</p>
				{footerAction ? (
					<div className="shrink-0 sm:ms-auto">{footerAction}</div>
				) : null}
			</div>
		</div>
	);
}
