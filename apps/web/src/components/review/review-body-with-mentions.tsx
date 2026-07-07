"use client";

import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { castCrewMetaLine } from "@/lib/cast-crew-search-query";
import {
	type ContentMentionPart,
	parseBodyWithMentions,
} from "@/lib/content-mentions";

const MENTION_LINK_CLASS =
	"inline-flex max-w-full items-baseline gap-0.5 font-medium text-foreground/90 underline decoration-foreground/25 underline-offset-2 transition-colors [@media(hover:hover)]:hover:text-desert-orange [@media(hover:hover)]:hover:decoration-desert-orange/40";

/** Name + outbound arrow — stored tokens hide `#` / `@` prefixes from readers. */
function MentionLinkContent({ label }: { label: string }) {
	return (
		<>
			<span>{label}</span>
			<ArrowUpRight
				className="size-3.5 shrink-0 translate-y-px opacity-80"
				aria-hidden
			/>
		</>
	);
}

type BodyWithMentionsProps = {
	body: string;
	className?: string;
	/** Override default mention link styling (e.g. inline links inside line-clamp). */
	mentionLinkClassName?: string;
	/** When set, mention taps call this instead of navigating (e.g. carousel opens drawer). */
	onMentionClick?: () => void;
} & Omit<ComponentPropsWithoutRef<"span">, "children">;

function mentionPartHref(part: ContentMentionPart): string | null {
	if (part.type === "text") return null;
	return part.href;
}

function mentionPartKey(part: ContentMentionPart, index: number): string {
	if (part.type === "text") return `text-${index}-${part.value.length}`;
	return `${part.type}-${part.href}-${part.label}`;
}

/** Renders review/comment copy with clickable listing, person, and patron links. */
export function BodyWithMentions({
	body,
	className,
	mentionLinkClassName,
	onMentionClick,
	...rest
}: BodyWithMentionsProps) {
	const parts = parseBodyWithMentions(body);
	const linkClassName = mentionLinkClassName ?? MENTION_LINK_CLASS;

	return (
		<span className={className} {...rest}>
			{parts.map((part, index) => {
				const partKey = mentionPartKey(part, index);

				if (part.type === "text") {
					return <span key={partKey}>{part.value}</span>;
				}

				const href = mentionPartHref(part);
				if (!href) return null;

				if (onMentionClick) {
					return (
						<button
							key={partKey}
							type="button"
							className={cn(
								linkClassName,
								"inline cursor-pointer bg-transparent p-0",
							)}
							onClick={(event) => {
								event.stopPropagation();
								onMentionClick();
							}}
						>
							<MentionLinkContent label={part.label} />
						</button>
					);
				}

				return (
					<Link
						key={partKey}
						href={href}
						className={linkClassName}
						onClick={(event) => event.stopPropagation()}
					>
						<MentionLinkContent label={part.label} />
					</Link>
				);
			})}
		</span>
	);
}

/** @deprecated Use `BodyWithMentions` — kept for existing imports. */
export const ReviewBodyWithMentions = BodyWithMentions;

/** Compact row for the composer `#` listing picker. */
export function ListingMentionPickerRow({
	title,
	subtitle,
	posterUrl,
	active,
	onSelect,
	onMouseEnter,
}: {
	title: string;
	subtitle: string;
	posterUrl: string | null;
	active: boolean;
	onSelect: () => void;
	/** Sync keyboard highlight when the pointer moves over a row. */
	onMouseEnter?: () => void;
}) {
	return (
		<button
			type="button"
			role="option"
			aria-selected={active}
			className={cn(
				"flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors",
				active ? "bg-foreground/10 text-foreground" : "text-foreground/90",
			)}
			onMouseEnter={onMouseEnter}
			onMouseDown={(event) => {
				// Keep focus in the textarea when picking a title.
				event.preventDefault();
				onSelect();
			}}
		>
			<div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted/40">
				{posterUrl ? (
					<Image
						src={posterUrl}
						alt=""
						fill
						sizes="40px"
						className="object-cover"
						unoptimized
					/>
				) : null}
			</div>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium">{title}</span>
				<span className="block truncate text-muted-foreground text-xs">
					{subtitle}
				</span>
			</span>
		</button>
	);
}

/** Compact row for the composer `@` cast/crew picker. */
export function PersonMentionPickerRow({
	name,
	subtitle,
	profileUrl,
	active,
	onSelect,
	onMouseEnter,
}: {
	name: string;
	subtitle: string;
	profileUrl: string | null;
	active: boolean;
	onSelect: () => void;
	onMouseEnter?: () => void;
}) {
	return (
		<button
			type="button"
			role="option"
			aria-selected={active}
			className={cn(
				"flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors",
				active ? "bg-foreground/10 text-foreground" : "text-foreground/90",
			)}
			onMouseEnter={onMouseEnter}
			onMouseDown={(event) => {
				event.preventDefault();
				onSelect();
			}}
		>
			<div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted/40">
				{profileUrl ? (
					<Image
						src={profileUrl}
						alt=""
						fill
						sizes="40px"
						className="object-cover"
						unoptimized
					/>
				) : null}
			</div>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium">{name}</span>
				<span className="block truncate text-muted-foreground text-xs">
					{subtitle}
				</span>
			</span>
		</button>
	);
}

/** Compact row for the composer `@` patron picker. */
export function PatronMentionPickerRow({
	displayName,
	handle,
	portraitUrl,
	active,
	onSelect,
	onMouseEnter,
}: {
	displayName: string;
	handle: string;
	portraitUrl: string | null;
	active: boolean;
	onSelect: () => void;
	onMouseEnter?: () => void;
}) {
	return (
		<button
			type="button"
			role="option"
			aria-selected={active}
			className={cn(
				"flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors",
				active ? "bg-foreground/10 text-foreground" : "text-foreground/90",
			)}
			onMouseEnter={onMouseEnter}
			onMouseDown={(event) => {
				event.preventDefault();
				onSelect();
			}}
		>
			<div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted/40">
				<PatronPortraitAvatar
					handle={handle}
					avatarUrl={portraitUrl}
					name={displayName}
					width={40}
					height={40}
					className="size-full"
				/>
			</div>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium">{displayName}</span>
				<span className="block truncate text-muted-foreground text-xs">
					@{handle}
				</span>
			</span>
		</button>
	);
}

/** Re-export for mention picker subtitles on TMDb search hits. */
export { castCrewMetaLine };
