"use client";

import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { LandingMarkPill } from "@/app/_marketing/landing-mark-pill";
import {
	PricingFaqMinusIcon,
	PricingFaqPlusIcon,
} from "@/components/pricing/pricing-faq-icons";
import { APP_NAME } from "@/lib/app-brand";
import {
	COMPANION_BEATS,
	COMPANION_CLOSING,
	COMPANION_FAQ_ITEMS,
	COMPANION_HERO,
	COMPANION_PROBLEM,
	COMPANION_SERVICES,
	COMPANION_SETUP,
	COMPANION_SPECIMEN,
	type CompanionBeatId,
	type CompanionFaqItem,
} from "@/lib/companion-page-copy";
import {
	companionChromeStoreUrl,
	companionEdgeStoreUrl,
} from "@/lib/companion-store-urls";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

const PRIMARY_PILL =
	"inline-flex h-11 select-none items-center justify-center rounded-full bg-foreground px-5 font-sans font-semibold text-background text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SECONDARY_PILL =
	"inline-flex h-11 select-none items-center justify-center rounded-full bg-card px-5 font-sans font-medium text-foreground text-sm [@media(hover:hover)]:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** transitions.dev page-slide tokens (match globals.css). */
const PAGE_EASE = [0.22, 1, 0.36, 1] as const;
const SLIDE_PX = 8;
const SLIDE_SEC = 0.2;

const beatSlideVariants: Variants = {
	enter: (dir: "forward" | "back") => ({
		x: dir === "forward" ? SLIDE_PX : -SLIDE_PX,
		opacity: 0,
		filter: "blur(3px)",
	}),
	center: {
		x: 0,
		opacity: 1,
		filter: "blur(0px)",
		transition: { duration: SLIDE_SEC, ease: PAGE_EASE },
	},
	exit: (dir: "forward" | "back") => ({
		x: dir === "forward" ? -SLIDE_PX : SLIDE_PX,
		opacity: 0,
		filter: "blur(3px)",
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		transition: { duration: SLIDE_SEC, ease: PAGE_EASE },
	}),
};

// function HeadlineBrandChip({
// 	label,
// 	children,
// 	className,
// }: {
// 	label: string;
// 	children: ReactNode;
// 	className?: string;
// }) {
// 	return (
// 		<span className="mb-1.5 inline-flex items-center gap-[0.20em] whitespace-nowrap align-middle">
// 			<span
// 				aria-hidden
// 				className={cn(
// 					"relative inline-flex size-[0.98em] shrink-0 items-center justify-center overflow-hidden rounded-[30%] align-middle",
// 					className,
// 				)}
// 			>
// 				{children}
// 			</span>
// 			{label}
// 		</span>
// 	);
// }

function readResizeDurationMs(el: HTMLElement): number {
	const raw = getComputedStyle(el).getPropertyValue("--resize-dur").trim();
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return 300;
	return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

function CompanionFaqRow({
	item,
	open,
	onToggle,
}: {
	item: CompanionFaqItem;
	open: boolean;
	onToggle: () => void;
}) {
	const reactId = useId();
	const headerId = `${reactId}-header`;
	const panelId = `${reactId}-panel`;
	const innerRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLElement>(null);
	const [height, setHeight] = useState(0);
	const [surfaceOpen, setSurfaceOpen] = useState(open);

	useLayoutEffect(() => {
		const inner = innerRef.current;
		if (!inner) return;
		setHeight(inner.scrollHeight);
	}, [open, item.answer]);

	useLayoutEffect(() => {
		if (open) {
			setSurfaceOpen(true);
			return;
		}
		const panel = panelRef.current;
		const hold = panel ? readResizeDurationMs(panel) : 300;
		const id = window.setTimeout(() => setSurfaceOpen(false), hold);
		return () => window.clearTimeout(id);
	}, [open]);

	return (
		<div className="border-0 border-border/40 border-b last:border-b-0">
			<h3>
				<button
					type="button"
					id={headerId}
					aria-controls={panelId}
					aria-expanded={open}
					onClick={onToggle}
					className="flex w-full select-none items-center justify-between gap-4 py-5 text-left font-medium font-sans text-base text-foreground tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{item.question}
					<span className="shrink-0 text-muted-foreground" aria-hidden>
						{open ? <PricingFaqMinusIcon /> : <PricingFaqPlusIcon />}
					</span>
				</button>
			</h3>
			<section
				ref={panelRef}
				id={panelId}
				aria-labelledby={headerId}
				aria-hidden={!open}
				className={cn("t-resize overflow-hidden", surfaceOpen && "is-open")}
				style={{ height: open ? height : 0 }}
			>
				<div ref={innerRef} className="pb-5">
					<p className="max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
						{item.answer}
					</p>
				</div>
			</section>
		</div>
	);
}

/** Hero product object — decorative controls are not button-shaped. */
// function CompanionHeroStage() {
// 	const posterUrl = tmdbPosterUrlFromPath(COMPANION_SPECIMEN.posterPath, "w342");

// 	return (
// 		<div
// 			className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] bg-card p-4 sm:p-6 lg:p-8"
// 			aria-hidden
// 		>
// 			<div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-6">
// 				<div className="relative mx-auto aspect-2/3 w-[9.5rem] shrink-0 overflow-hidden rounded-2xl bg-background sm:mx-0 sm:w-[11rem] lg:w-[12.5rem]">
// 					{posterUrl ? (
// 						<Image
// 							src={posterUrl}
// 							alt=""
// 							fill
// 							sizes="200px"
// 							className="object-cover"
// 							priority
// 						/>
// 					) : null}
// 				</div>

// 				<div className="flex min-w-0 flex-1 flex-col gap-3">
// 					<div className="flex flex-1 flex-col justify-center rounded-2xl bg-background px-4 py-4 sm:px-5 sm:py-5">
// 						<p className="font-sans font-semibold text-foreground text-xl tracking-tight sm:text-2xl">
// 							Watching
// 						</p>
// 						<p className="mt-3 font-sans font-medium text-foreground text-base">
// 							{COMPANION_SPECIMEN.title}
// 						</p>
// 						<p className="mt-0.5 text-muted-foreground text-sm">
// 							On {COMPANION_SPECIMEN.service}
// 						</p>
// 						<div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-card">
// 							<div className="h-full w-[62%] rounded-full bg-foreground/70" />
// 						</div>
// 						<p className="mt-3 text-muted-foreground text-xs">
// 							Tracking with Sense · View profile
// 						</p>
// 					</div>

// 					<div className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3.5">
// 						<div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-card">
// 							{posterUrl ? (
// 								<Image
// 									src={posterUrl}
// 									alt=""
// 									fill
// 									sizes="44px"
// 									className="object-cover"
// 								/>
// 							) : null}
// 						</div>
// 						<div className="min-w-0 flex-1 text-left">
// 							<p className="truncate font-sans font-medium text-foreground text-sm">
// 								Now watching on Sense
// 							</p>
// 							<p className="truncate text-muted-foreground text-xs">
// 								{COMPANION_SPECIMEN.title} · {COMPANION_SPECIMEN.service}
// 							</p>
// 						</div>
// 						<span className="shrink-0 font-sans text-[0.65rem] text-muted-foreground tabular-nums">
// 							Live
// 						</span>
// 					</div>

// 					{/* Log notice — plain copy, not a fake primary button. */}
// 					<div className="rounded-2xl bg-background px-4 py-3 text-left">
// 						<p className="font-sans font-medium text-foreground text-sm">
// 							Logged · {COMPANION_SPECIMEN.title}
// 						</p>
// 						<p className="mt-0.5 text-muted-foreground text-xs">
// 							At home · rate 0–10 or dismiss
// 						</p>
// 					</div>
// 				</div>
// 			</div>
// 		</div>
// 	);
// }

function CompanionBeatVisual({ id }: { id: CompanionBeatId }) {
	const posterUrl = tmdbPosterUrlFromPath(
		COMPANION_SPECIMEN.posterPath,
		"w185",
	);

	switch (id) {
		case "discord":
			return (
				<div className="rounded-2xl bg-background px-5 py-5 text-left">
					<p className="font-sans font-semibold text-foreground text-xl tracking-tight">
						Watching
					</p>
					<p className="mt-2 text-foreground text-sm">
						{COMPANION_SPECIMEN.title}
					</p>
					<p className="text-muted-foreground text-xs">
						On {COMPANION_SPECIMEN.service}
					</p>
				</div>
			);
		case "sense":
			return (
				<div className="flex items-center gap-3 rounded-2xl bg-background px-5 py-4">
					<div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-card">
						{posterUrl ? (
							<Image
								src={posterUrl}
								alt=""
								fill
								sizes="48px"
								className="object-cover"
							/>
						) : null}
					</div>
					<div className="min-w-0 text-left">
						<p className="truncate font-medium font-sans text-foreground text-sm">
							On your profile
						</p>
						<p className="truncate text-muted-foreground text-xs">
							Watching {COMPANION_SPECIMEN.title}
						</p>
					</div>
				</div>
			);
		case "autolog":
			return (
				<div className="rounded-2xl bg-background px-5 py-5 text-left">
					<p className="font-medium font-sans text-foreground text-sm">
						Logged · {COMPANION_SPECIMEN.title}
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						At home · rate when ready
					</p>
					<div className="mt-4 flex gap-1.5" aria-hidden>
						{["6", "7", "8", "9", "10"].map((n) => (
							<span
								key={n}
								className="flex size-8 items-center justify-center rounded-full bg-card font-sans text-muted-foreground text-xs tabular-nums"
							>
								{n}
							</span>
						))}
					</div>
				</div>
			);
		default: {
			const _exhaustive: never = id;
			return _exhaustive;
		}
	}
}

/**
 * Auto-scrolling TMDb provider PNG carousel — seamless 50% loop, pause on hover.
 * Reduced motion: static centered row (no loop).
 */
function CompanionServicesLogoCarousel() {
	const reduceMotion = useReducedMotion();
	const labels = COMPANION_SERVICES.map((s) => s.label).join(", ");
	/** Repeat so each marquee half is wider than the rail (smooth -50% loop on large viewports). */
	const loopServices = [
		...COMPANION_SERVICES,
		...COMPANION_SERVICES,
		...COMPANION_SERVICES,
	];

	const logoTile = (
		service: (typeof COMPANION_SERVICES)[number],
		key: string,
		announce: boolean,
	) => (
		<li key={key} className="shrink-0">
			{/* Transparent brand mark on canvas — no black TMDb plate. */}
			<span className="relative flex size-14 items-center justify-center overflow-hidden sm:size-35">
				<Image
					src={`${service.logoSrc}?v=tmdb-alpha`}
					alt=""
					width={64}
					height={64}
					className="size-[72%] object-contain"
					unoptimized
				/>
			</span>
			{announce ? <span className="sr-only">{service.label}</span> : null}
		</li>
	);

	if (reduceMotion) {
		return (
			<ul
				className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-3"
				aria-label={`Supported services: ${labels}`}
			>
				{COMPANION_SERVICES.map((service) =>
					logoTile(service, service.id, true),
				)}
			</ul>
		);
	}

	return (
		<div className="companion-services-marquee relative mx-auto mt-20 w-full max-w-5xl overflow-hidden">
			{/* Edge fades into canvas so the loop doesn’t hard-clip. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-background to-transparent sm:w-16"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-background to-transparent sm:w-16"
			/>
			<p className="col-span-6 text-center text-muted-foreground text-sm min-1200:col-span-14 min-1440:col-span-12 min-768:col-span-8 min-1200:col-start-2 min-1440:col-start-3">
				Works with all your favorite streaming services
			</p>
			<div className="companion-services-marquee-track">
				{[0, 1].map((pass) => (
					<ul key={pass} aria-hidden={pass === 1}>
						{loopServices.map((service, index) =>
							logoTile(
								service,
								`${pass}-${service.id}-${index}`,
								pass === 0 && index < COMPANION_SERVICES.length,
							),
						)}
					</ul>
				))}
			</div>
		</div>
	);
}

/** One mid-page story — page-slide between beats (transitions.dev). */
function CompanionBeatSequence() {
	const reduceMotion = useReducedMotion();
	const [beatId, setBeatId] = useState<CompanionBeatId>(COMPANION_BEATS[0].id);
	const prevIdRef = useRef(beatId);
	const directionRef = useRef<"forward" | "back">("forward");

	const activeIndex = COMPANION_BEATS.findIndex((b) => b.id === beatId);
	const active = COMPANION_BEATS[activeIndex] ?? COMPANION_BEATS[0];

	if (beatId !== prevIdRef.current) {
		const prev = COMPANION_BEATS.findIndex((b) => b.id === prevIdRef.current);
		const next = COMPANION_BEATS.findIndex((b) => b.id === beatId);
		directionRef.current = next >= prev ? "forward" : "back";
		prevIdRef.current = beatId;
	}
	const direction = directionRef.current;

	return (
		<section
			aria-labelledby="companion-beats-heading"
			className="mx-auto w-full max-w-3xl px-5 sm:px-8"
		>
			<h2
				id="companion-beats-heading"
				className="text-balance text-center font-sans font-semibold text-[clamp(1.75rem,4vw,2.5rem)] text-foreground tracking-tight"
			>
				Where it shows up
			</h2>

			{/* Segmented beat switch — same pill language as /home chips. */}
			<div
				className="mx-auto mt-8 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full bg-card p-1"
				role="tablist"
				aria-label="Companion surfaces"
			>
				{COMPANION_BEATS.map((beat) => {
					const selected = beat.id === beatId;
					return (
						<button
							key={beat.id}
							type="button"
							role="tab"
							aria-selected={selected}
							onClick={() => setBeatId(beat.id)}
							className={cn(
								"select-none rounded-full px-4 py-2 font-sans text-sm transition-colors",
								selected
									? "bg-background font-semibold text-foreground"
									: "font-medium text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
							)}
						>
							{beat.label}
						</button>
					);
				})}
			</div>

			<div
				className={cn(
					"t-page-slide relative mx-auto mt-8 min-h-[14rem] w-full overflow-hidden",
				)}
				data-direction={direction}
				data-legal-slide=""
			>
				{reduceMotion ? (
					<div className="rounded-[1.75rem] bg-card p-5 sm:p-7">
						<CompanionBeatVisual id={active.id} />
						<h3 className="mt-5 font-sans font-semibold text-foreground text-xl tracking-tight">
							{active.heading}
						</h3>
						<p className="mt-2 text-pretty text-base text-muted-foreground leading-relaxed">
							{active.body}
						</p>
					</div>
				) : (
					<AnimatePresence custom={direction} initial={false} mode="sync">
						<motion.div
							key={active.id}
							animate="center"
							className="t-page relative w-full rounded-[1.75rem] bg-card p-5 sm:p-7"
							custom={direction}
							exit="exit"
							initial="enter"
							variants={beatSlideVariants}
							role="tabpanel"
						>
							<CompanionBeatVisual id={active.id} />
							<h3 className="mt-5 font-sans font-semibold text-foreground text-xl tracking-tight">
								{active.heading}
							</h3>
							<p className="mt-2 text-pretty text-base text-muted-foreground leading-relaxed">
								{active.body}
							</p>
						</motion.div>
					</AnimatePresence>
				)}
			</div>
		</section>
	);
}

/**
 * Public Companion intro — critique pass: one story, honest CTAs, varied surfaces.
 */

export function HeroIconSlot({
	src,
	label,
	bg,
	delayMs,
	padded = false,
}: {
	src: string;
	label: string;
	bg?: string;
	delayMs: number;
	/** true when the PNG is a bare glyph (no background of its own) */
	padded?: boolean;
}) {
	const style = { animationDelay: `${delayMs}ms` };
	return (
		<span className="hero-slot" style={style}>
			<span className="hero-slot-inner" style={style}>
				<button type="button" className="hero-icon-button" aria-label={label}>
					<span
						className="hero-icon-layer overflow-hidden"
						style={bg ? { background: bg } : undefined}
					>
						<Image
							src={src}
							alt=""
							fill
							unoptimized
							draggable={false}
							sizes="(min-width: 1200px) 68px, (min-width: 769px) 48px, 34px"
							className={cn(
								"pointer-events-none select-none",
								padded ? "object-contain p-[18%]" : "object-cover",
							)}
						/>
					</span>
				</button>
			</span>
		</span>
	);
}

export function CompanionPage() {
	const chromeUrl = companionChromeStoreUrl();
	const edgeUrl = companionEdgeStoreUrl();
	const hasStore = Boolean(chromeUrl || edgeUrl);
	const primaryLabel = hasStore
		? COMPANION_HERO.storeCtaLabel
		: COMPANION_HERO.setupCtaLabel;
	const [faqOpenId, setFaqOpenId] = useState<string | null>(
		COMPANION_FAQ_ITEMS[0]?.id ?? null,
	);

	return (
		<div className="min-h-svh bg-background text-foreground">
			<header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
				<nav
					aria-label="Sense"
					className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-2 rounded-full bg-card/80 p-1.5 pl-2 backdrop-blur-lg"
				>
					{/* Mark only — page title lives in the document, not a second pill. */}
					<LandingMarkPill className="w-fit min-w-0 bg-background px-3 text-sm sm:px-4 sm:text-base" />
					<div className="flex shrink-0 items-center gap-1.5">
						<Link
							href="/sign-in"
							className="inline-flex h-11 items-center justify-center rounded-full px-3 font-sans text-muted-foreground text-sm sm:px-4 [@media(hover:hover)]:hover:text-foreground"
						>
							Sign in
						</Link>
						<a href="#install" className={PRIMARY_PILL}>
							{primaryLabel}
						</a>
					</div>
				</nav>
			</header>

			<main className="pt-[min(7rem,15vh)] pb-20 sm:pb-28">
				{/* Hero: stage + claim + CTA tight (no decorative orbits). */}
				<section className="flex min-h-[min(720px,calc(100svh-80px))] flex-col justify-center bg-background-primary pt-[128px] pb-40 min-1200:min-h-[min(960px,calc(100svh-124px))] min-768:min-h-[min(820px,calc(100svh-124px))] min-1200:pt-[200px] min-768:pt-[160px] min-1200:pb-80 min-768:pb-64">
					{/* <CompanionHeroStage /> */}

					<div className="mx-auto grid w-full max-w-(--breakpoint-min-1728) grid-cols-[repeat(6,minmax(0,1fr))] grid-rows-[repeat(1,fit-content(100%))] gap-x-20 gap-y-[var(--grid-row-gap,200px)] self-stretch px-20 [--grid-row-gap:40px] min-1200:grid-cols-[repeat(16,minmax(0,1fr))] min-1440:grid-cols-[repeat(16,minmax(0,1fr))] min-768:grid-cols-[repeat(8,minmax(0,1fr))] min-[769px]:[--grid-row-gap:64px]">
						<div className="col-span-6 flex flex-col items-center gap-y-24 text-center min-1200:col-span-12 min-1440:col-span-10 min-768:col-span-6 min-1200:col-start-3 min-1440:col-start-4 min-768:col-start-2 min-[769px]:gap-y-10">
							<h1 className="flex flex-col text-balance font-[652] text-[clamp(2.5rem,7vw,5rem)] text-foreground leading-none tracking-[-0.6px]">
								<span className="h1 block">Watch anything.</span>
								<span className="h1 h1-second-line block">
									Show it on
									<HeroIconSlot
										src="/companion/services/discord-logo.png"
										label="Discord"
										bg="#5865F2"
										padded
										delayMs={1400}
									/>
									Discord.
								</span>
								<span className="h1 h1-third-line block">
									Log it on
									<HeroIconSlot
										src="/your-sense-logo.png"
										label="Sense"
										delayMs={1550}
									/>
									Sense.
								</span>
							</h1>
							<p className="mx-auto max-w-lg text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
								{COMPANION_HERO.subline}
							</p>
						</div>
						<div className="col-span-4 col-start-2 flex flex-col items-center min-1200:col-start-7 min-768:col-start-3">
							<div className="flex items-center justify-center gap-x-8">
								<a href="#install" className={PRIMARY_PILL}>
									{primaryLabel}
								</a>
								<Link
									href={COMPANION_HERO.secondaryCta.href}
									className={SECONDARY_PILL}
								>
									{COMPANION_HERO.secondaryCta.label}
								</Link>
							</div>
						</div>
					</div>
					{/* One services moment — PNG logo carousel. */}
					<CompanionServicesLogoCarousel />
				</section>

				{/* Problem — typography only, no card plate. */}
				<section className="mx-auto mt-16 w-full max-w-2xl px-5 text-center sm:mt-20 sm:px-8">
					<div className="space-y-2 text-balance font-sans font-semibold text-[clamp(1.35rem,3.5vw,1.85rem)] leading-snug tracking-tight">
						{COMPANION_PROBLEM.lines.map((line) => (
							<p key={line} className="text-muted-foreground">
								{line}
							</p>
						))}
						<p className="pt-1 text-foreground">{COMPANION_PROBLEM.fix}</p>
					</div>
				</section>

				<div className="mt-16 sm:mt-20">
					<CompanionBeatSequence />
				</div>

				{/* Install — unique weight: canvas steps inside one install shell. */}
				<section
					id="install"
					aria-labelledby="companion-setup-heading"
					className="mx-auto mt-16 w-full max-w-4xl scroll-mt-28 px-5 sm:mt-24 sm:px-8"
				>
					<div className="rounded-[2rem] bg-card px-5 py-10 sm:px-10 sm:py-12">
						<h2
							id="companion-setup-heading"
							className="text-balance text-center font-sans font-semibold text-[clamp(1.75rem,4vw,2.5rem)] text-foreground tracking-tight"
						>
							{COMPANION_SETUP.heading}
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-center text-base text-muted-foreground leading-relaxed">
							{COMPANION_SETUP.subline}
						</p>

						<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
							{chromeUrl ? (
								<a
									href={chromeUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={PRIMARY_PILL}
								>
									Chrome Web Store
								</a>
							) : null}
							{edgeUrl ? (
								<a
									href={edgeUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={SECONDARY_PILL}
								>
									Edge Add-ons
								</a>
							) : null}
							{!hasStore ? (
								<p className="w-full text-center text-muted-foreground text-sm">
									{COMPANION_SETUP.storeSoonLabel}
								</p>
							) : null}
							<Link
								href="/me/settings/profile"
								className={hasStore ? SECONDARY_PILL : PRIMARY_PILL}
							>
								Open Settings to pair
							</Link>
						</div>

						<ol className="mt-10 flex flex-col gap-6">
							{COMPANION_SETUP.steps.map((step, index) => (
								<li key={step.id} className="flex gap-4">
									<span
										className="flex size-9 shrink-0 select-none items-center justify-center rounded-full bg-background font-sans font-semibold text-foreground text-sm tabular-nums"
										aria-hidden
									>
										{index + 1}
									</span>
									<div className="min-w-0 text-left">
										<h3 className="font-sans font-semibold text-base text-foreground tracking-tight sm:text-lg">
											{step.title}
										</h3>
										<p className="mt-1 text-pretty text-muted-foreground text-sm leading-relaxed">
											{step.body}
										</p>
									</div>
								</li>
							))}
						</ol>
					</div>
				</section>

				<section
					id="faq"
					aria-labelledby="companion-faq-heading"
					className="mx-auto mt-16 w-full max-w-2xl px-5 sm:mt-20 sm:px-8"
				>
					<h2
						id="companion-faq-heading"
						className="text-balance text-center font-sans font-semibold text-[clamp(1.75rem,4vw,2.5rem)] text-foreground tracking-tight"
					>
						Frequently asked questions
					</h2>
					<div className="mt-8">
						{COMPANION_FAQ_ITEMS.map((item) => (
							<CompanionFaqRow
								key={item.id}
								item={item}
								open={faqOpenId === item.id}
								onToggle={() =>
									setFaqOpenId((prev) => (prev === item.id ? null : item.id))
								}
							/>
						))}
					</div>
				</section>

				{/* Closing — typography + actions, not another identical card. */}
				<section className="mx-auto mt-16 w-full max-w-xl px-5 text-center sm:mt-24 sm:px-8">
					<h2 className="text-balance font-sans font-semibold text-[clamp(1.75rem,4vw,2.5rem)] text-foreground tracking-tight">
						{COMPANION_CLOSING.heading}
					</h2>
					<p className="mx-auto mt-4 text-base text-muted-foreground leading-relaxed">
						{COMPANION_CLOSING.body}
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<a href="#install" className={PRIMARY_PILL}>
							{primaryLabel}
						</a>
						<Link
							href={COMPANION_CLOSING.secondaryCta.href}
							className={SECONDARY_PILL}
						>
							{COMPANION_CLOSING.secondaryCta.label}
						</Link>
					</div>
				</section>

				<footer className="mx-auto mt-16 w-full max-w-[52.125rem] px-5 pt-6 text-center text-muted-foreground text-xs sm:mt-20 sm:px-8">
					<ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
						<li>
							<span className="text-foreground" aria-current="page">
								Companion
							</span>
						</li>
						<li>
							<Link
								href="/pricing"
								className="[@media(hover:hover)]:hover:text-foreground"
							>
								Pricing
							</Link>
						</li>
						<li>
							<Link
								href="/privacy"
								className="[@media(hover:hover)]:hover:text-foreground"
							>
								Privacy
							</Link>
						</li>
						<li>
							<Link
								href="/sign-in"
								className="[@media(hover:hover)]:hover:text-foreground"
							>
								Sign in
							</Link>
						</li>
					</ul>
					<p className="mt-6">
						© {new Date().getFullYear()} {APP_NAME}.
					</p>
				</footer>
			</main>
		</div>
	);
}
