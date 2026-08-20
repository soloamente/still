"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState } from "react";

import {
	PricingFaqMinusIcon,
	PricingFaqPlusIcon,
} from "@/components/pricing/pricing-faq-icons";
import {
	PRICING_FAQ_HEADING_ID,
	PRICING_FAQ_ITEMS,
	PRICING_FAQ_SECTION_ID,
	type PricingFaqItem,
	splitFaqAnswerWithLinks,
} from "@/lib/pricing-faq";

/** In-copy FAQ links — underline from the font so they don't rely on color alone. */
const FAQ_INLINE_LINK_CLASSNAME = cn(
	"text-foreground underline decoration-from-font underline-offset-4",
	"[@media(hover:hover)]:hover:opacity-80",
);

function PricingFaqAnswer({ item }: { item: PricingFaqItem }) {
	const parts = splitFaqAnswerWithLinks(item.answerPlain, item.links ?? []);

	return (
		<p className="max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
			{parts.map((part) => {
				switch (part.type) {
					case "text":
						return <span key={`text:${part.text}`}>{part.text}</span>;
					case "link":
						return (
							<Link
								key={`link:${part.href}`}
								href={part.href}
								className={FAQ_INLINE_LINK_CLASSNAME}
							>
								{part.label}
							</Link>
						);
					default: {
						const _exhaustive: never = part;
						return _exhaustive;
					}
				}
			})}
		</p>
	);
}

function readResizeDurationMs(el: HTMLElement): number {
	const raw = getComputedStyle(el).getPropertyValue("--resize-dur").trim();
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return 300;
	return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

function PricingFaqItemRow({
	item,
	open,
	onToggle,
}: {
	item: PricingFaqItem;
	open: boolean;
	onToggle: () => void;
}) {
	const reactId = useId();
	const headerId = `${reactId}-header`;
	const panelId = `${reactId}-panel`;
	const innerRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLElement>(null);
	const [height, setHeight] = useState(0);
	// Keep the canvas well until the height tween finishes so close matches open.
	const [surfaceOpen, setSurfaceOpen] = useState(open);

	// Measure the answer so `.t-resize` can tween an explicit height.
	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) return;

		const syncHeight = () => {
			const next = el.scrollHeight;
			// Ignore 0 while clipping closed — that would snap the next open.
			if (next > 0) setHeight(next);
		};

		syncHeight();
		const observer = new ResizeObserver(syncHeight);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useLayoutEffect(() => {
		if (open) {
			setSurfaceOpen(true);
			return;
		}

		const panel = panelRef.current;
		if (!panel) {
			setSurfaceOpen(false);
			return;
		}

		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduced) {
			setSurfaceOpen(false);
			return;
		}

		const finish = () => setSurfaceOpen(false);
		const onEnd = (event: TransitionEvent) => {
			if (event.target !== panel) return;
			if (event.propertyName !== "height") return;
			finish();
		};
		panel.addEventListener("transitionend", onEnd);
		const timeout = window.setTimeout(finish, readResizeDurationMs(panel) + 20);
		return () => {
			panel.removeEventListener("transitionend", onEnd);
			window.clearTimeout(timeout);
		};
	}, [open]);

	return (
		<div className={cn("rounded-2xl", surfaceOpen && "bg-background")}>
			<h3 className="m-0">
				<button
					type="button"
					id={headerId}
					aria-expanded={open}
					aria-controls={panelId}
					onClick={onToggle}
					className={cn(
						"group flex min-h-11 w-full select-none items-center justify-between gap-4",
						"rounded-2xl px-4 py-3 text-start font-medium text-[15px] text-foreground leading-snug",
						"[@media(hover:hover)]:hover:bg-background",
						surfaceOpen && "[@media(hover:hover)]:hover:bg-transparent",
					)}
				>
					<span className="min-w-0 text-pretty">{item.question}</span>
					{/* Plus ↔ minus — transitions.dev icon-swap; decorative next to the question. */}
					<span
						className={cn(
							"t-icon-swap grid size-10 shrink-0 place-items-center rounded-full text-foreground",
							// Invert the pill against the row: canvas on card, card on an open canvas row.
							surfaceOpen
								? "bg-card"
								: "bg-background [@media(hover:hover)]:group-hover:bg-card",
						)}
						data-state={open ? "b" : "a"}
						aria-hidden
					>
						<span className="t-icon" data-icon="a">
							<PricingFaqPlusIcon />
						</span>
						<span className="t-icon" data-icon="b">
							<PricingFaqMinusIcon />
						</span>
					</span>
				</button>
			</h3>
			<section
				ref={panelRef}
				id={panelId}
				aria-labelledby={headerId}
				aria-hidden={!open}
				className="t-resize overflow-hidden [--resize-ease:cubic-bezier(0.45,0,0.55,1)]"
				style={{ height: open ? height : 0 }}
				inert={!open}
			>
				<div ref={innerRef} className="px-4 pb-4">
					<PricingFaqAnswer item={item} />
				</div>
			</section>
		</div>
	);
}

/** Pricing Q&A — one open row at a time; height tweens with `.t-resize`. */
export function PricingFaqSection() {
	const [openId, setOpenId] = useState<string | null>(null);

	return (
		<section
			id={PRICING_FAQ_SECTION_ID}
			className="mt-20 scroll-mt-28"
			aria-labelledby={PRICING_FAQ_HEADING_ID}
		>
			<h2
				id={PRICING_FAQ_HEADING_ID}
				className="text-center font-sans font-semibold text-2xl tracking-[-0.03em] sm:text-3xl"
			>
				Questions
			</h2>
			<p className="mx-auto mt-3 max-w-md text-balance text-center text-muted-foreground text-sm leading-relaxed">
				Billing, plans, and what stays free.
			</p>

			{/* Raised card — same chrome as Compare. Inner radius is concentric (24 − 8). */}
			<div className="mx-auto mt-8 max-w-2xl rounded-mobbin-3xl bg-card p-2 sm:p-3">
				<div className="flex flex-col gap-1">
					{PRICING_FAQ_ITEMS.map((item) => (
						<PricingFaqItemRow
							key={item.id}
							item={item}
							open={openId === item.id}
							onToggle={() =>
								setOpenId((current) => (current === item.id ? null : item.id))
							}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
