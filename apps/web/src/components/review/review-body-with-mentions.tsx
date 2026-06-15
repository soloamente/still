"use client";

import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { parseReviewBodyWithMentions } from "@/lib/review-listing-mentions";

const MENTION_LINK_CLASS =
	"inline-flex max-w-full items-baseline gap-0.5 font-medium text-foreground/90 underline decoration-foreground/25 underline-offset-2 transition-colors [@media(hover:hover)]:hover:text-desert-orange [@media(hover:hover)]:hover:decoration-desert-orange/40";

/** Title + outbound arrow — stored tokens stay `@[Title](…)` but readers never see `@`. */
function ReviewListingMentionContent({ label }: { label: string }) {
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

type ReviewBodyWithMentionsProps = {
	body: string;
	className?: string;
	/** When set, mention taps call this instead of navigating (e.g. carousel opens drawer). */
	onMentionClick?: () => void;
} & Omit<ComponentPropsWithoutRef<"span">, "children">;

/** Renders review copy with clickable film/TV title links. */
export function ReviewBodyWithMentions({
	body,
	className,
	onMentionClick,
	...rest
}: ReviewBodyWithMentionsProps) {
	const parts = parseReviewBodyWithMentions(body);

	return (
		<span className={className} {...rest}>
			{parts.map((part, index) => {
				const partKey =
					part.type === "text"
						? `text-${index}-${part.value.length}`
						: `mention-${part.href}-${part.label}`;

				if (part.type === "text") {
					return <span key={partKey}>{part.value}</span>;
				}

				if (onMentionClick) {
					return (
						<button
							key={partKey}
							type="button"
							className={cn(
								MENTION_LINK_CLASS,
								"inline cursor-pointer bg-transparent p-0",
							)}
							onClick={(event) => {
								event.stopPropagation();
								onMentionClick();
							}}
						>
							<ReviewListingMentionContent label={part.label} />
						</button>
					);
				}

				return (
					<Link
						key={partKey}
						href={part.href}
						className={MENTION_LINK_CLASS}
						onClick={(event) => event.stopPropagation()}
					>
						<ReviewListingMentionContent label={part.label} />
					</Link>
				);
			})}
		</span>
	);
}

/** Compact row for the composer `@` picker. */
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
