"use client";

import type { PlanTierId } from "@still/plans";
import { cn } from "@still/ui/lib/utils";
import { motion } from "motion/react";
import Link from "next/link";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import {
	HoloMembershipFace,
	HoloMembershipTile,
} from "@/components/profile/holo-membership-face";
import { useHoloCardLoop } from "@/hooks/use-holo-card-loop";
import { APP_NAME } from "@/lib/app-brand";
import { subscriptionHoloAppearance } from "@/lib/holo/tier-print";
import { profilePatronAvatarImageUrl } from "@/lib/profile-avatar";
import { profileMediaCacheKey } from "@/lib/profile-media-cache-key";
import {
	formatSubscriptionBillingInterval,
	SUBSCRIPTION_TIER_LABELS,
	SUBSCRIPTION_TIER_TAGLINES,
	type SubscriptionBillingStatus,
	subscriptionStatusBadgeCopy,
} from "@/lib/subscription-identity-card";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

export type { SubscriptionBillingStatus } from "@/lib/subscription-identity-card";

const PRESSABLE_PILL_CLASS =
	"transition-[transform,colors] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100";

/** Fill the flip stage — host already owns the credit-card aspect box. */
const HOLO_FACE_FILL_CLASS = "absolute inset-0 size-full";
const HOLO_FACE_FILL_STYLE = { aspectRatio: "auto" } as const;

function PlanStatusBadge({
	status,
	className,
}: {
	status: SubscriptionBillingStatus;
	className?: string;
}) {
	const copy = subscriptionStatusBadgeCopy(status);
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-1 font-medium text-xs",
				copy.className,
				className,
			)}
		>
			{copy.label}
		</span>
	);
}

function readTextSwapDurationMs(): number {
	const parsed = Number.parseFloat(
		getComputedStyle(document.documentElement)
			.getPropertyValue("--text-swap-dur")
			.trim(),
	);
	return Number.isFinite(parsed) ? parsed : 150;
}

/** transitions.dev text-states-swap for Show billing ↔ Show identity. */
function runTextStateSwap(el: HTMLElement, next: string) {
	const dur = readTextSwapDurationMs();
	el.classList.add("is-exit");
	window.setTimeout(() => {
		el.textContent = next;
		el.classList.remove("is-exit");
		el.classList.add("is-enter-start");
		void el.offsetHeight;
		el.classList.remove("is-enter-start");
	}, dur);
}

/**
 * Membership identity card for Settings → Subscription — Holo foil tilt + Motion flip.
 * Billing actions live on the back; plan context + upgrades sit in the companion rail.
 */
export function MeSubscriptionIdentityCard({
	handle,
	displayName,
	avatarUrl,
	effectiveTier,
	subscriptionTier,
	planOverride,
	subscriptionStatus,
	billingInterval,
	canManagePolarBilling,
	portalLoading,
	onManage,
	showAttunedUpgrade,
	showImmersedUpgrade,
}: {
	handle: string;
	displayName: string;
	/** Raw `user.image` for cache-bust — portrait src always goes through the proxy. */
	avatarUrl: string | null;
	effectiveTier: PlanTierId;
	subscriptionTier: PlanTierId;
	planOverride: PlanTierId | null;
	subscriptionStatus: SubscriptionBillingStatus;
	billingInterval: "month" | "year" | null;
	canManagePolarBilling: boolean;
	portalLoading: boolean;
	onManage: () => void;
	showAttunedUpgrade: boolean;
	showImmersedUpgrade: boolean;
}) {
	const reduceMotion = usePrefersReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const [hoverCapable, setHoverCapable] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(hover: hover)");
		const sync = () => setHoverCapable(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	// Holo tilt only on fine hover pointers — never chase touch or reduced-motion / soft GPU.
	const tiltEnabled = !reduceMotion && !softwareGpu && hoverCapable;

	const [flipped, setFlipped] = useState(false);
	const flipControlRef = useRef<HTMLButtonElement>(null);
	const flipLabelRef = useRef<HTMLSpanElement>(null);
	const manageButtonRef = useRef<HTMLButtonElement>(null);
	// Pointer hit target + perspective — Holo applyFrame owns --rx/--ry (no Motion tilt).
	const hostRef = useRef<HTMLDivElement>(null);
	const frontFaceRef = useRef<HTMLDivElement>(null);
	const backFaceRef = useRef<HTMLDivElement>(null);
	const flipMountedRef = useRef(false);

	const appearance = subscriptionHoloAppearance(effectiveTier);
	const tileSrc = profilePatronAvatarImageUrl(
		handle,
		profileMediaCacheKey(avatarUrl),
	);

	useHoloCardLoop({
		hostRef,
		faceRefs: [frontFaceRef, backFaceRef],
		foil: appearance.foil,
		opts: {
			tileSrc,
			bodyGrad: appearance.bodyGrad,
			tileDark: appearance.tileDark,
			tileLight: appearance.tileLight,
		},
		enabled: tiltEnabled,
	});

	const setFace = useCallback((next: boolean) => {
		setFlipped(next);
	}, []);

	useEffect(() => {
		if (!flipped) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setFace(false);
			flipControlRef.current?.focus();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [flipped, setFace]);

	const flipLabel = flipped ? "Show identity" : "Show billing";

	// Animate flip control label with transitions.dev text-states-swap.
	useLayoutEffect(() => {
		const el = flipLabelRef.current;
		if (!el) return;
		if (!flipMountedRef.current) {
			flipMountedRef.current = true;
			el.textContent = flipLabel;
			return;
		}
		if (reduceMotion) {
			el.textContent = flipLabel;
			return;
		}
		if (el.textContent === flipLabel) return;
		runTextStateSwap(el, flipLabel);
	}, [flipLabel, reduceMotion]);

	const handleFlipToggle = () => {
		const next = !flipped;
		setFace(next);
		window.requestAnimationFrame(() => {
			if (next && canManagePolarBilling) {
				manageButtonRef.current?.focus();
			} else {
				flipControlRef.current?.focus();
			}
		});
	};

	const tierLabel = SUBSCRIPTION_TIER_LABELS[effectiveTier];
	const tierTagline = SUBSCRIPTION_TIER_TAGLINES[effectiveTier];
	const intervalLabel = formatSubscriptionBillingInterval(billingInterval);
	const name = displayName.trim() || handle;

	const cardRegionLabel = flipped
		? `${APP_NAME} billing, ${tierLabel}`
		: `${APP_NAME} membership card, ${tierLabel}`;

	const flipTransition = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 260, damping: 28 };

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-mobbin-3xl bg-background">
			{/* Polite face change for assistive tech — visible faces stay aria-hidden when flipped away. */}
			<p className="sr-only" role="status" aria-live="polite">
				{flipped
					? `Showing billing for ${tierLabel}`
					: `Showing membership card for ${tierLabel}`}
			</p>

			<div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 content-center items-center gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:gap-12 xl:gap-16">
				{/* Larger card stage — fills more of the first fold on ultrawide viewports. */}
				<div className="flex w-full justify-center lg:justify-end">
					<div
						ref={hostRef}
						className="aspect-[1.586] w-full max-w-md lg:max-w-lg"
						style={{ perspective: "1200px" }}
					>
						{/* Motion owns flip only — Holo applyFrame sets --rx/--ry on each face. */}
						<motion.div
							id="me-subscription-identity-card"
							role="region"
							aria-label={cardRegionLabel}
							className="relative size-full"
							style={{ transformStyle: "preserve-3d" }}
							animate={{ rotateY: flipped ? 180 : 0 }}
							transition={flipTransition}
						>
							<CardFaces
								flipped={flipped}
								frontFaceRef={frontFaceRef}
								backFaceRef={backFaceRef}
								handle={handle}
								name={name}
								tierLabel={tierLabel}
								subscriptionTier={subscriptionTier}
								planOverride={planOverride}
								subscriptionStatus={subscriptionStatus}
								intervalLabel={intervalLabel}
								canManagePolarBilling={canManagePolarBilling}
								portalLoading={portalLoading}
								onManage={onManage}
								manageButtonRef={manageButtonRef}
							/>
						</motion.div>
					</div>
				</div>

				{/* Companion rail — plan context + flip/upgrades (single source for tagline). */}
				<aside className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-6 text-center lg:mx-0 lg:max-w-none lg:items-start lg:text-left">
					<div className="space-y-2">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
							Your plan
						</p>
						<p className="text-balance font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
							{tierLabel}
						</p>
						<p className="text-pretty text-muted-foreground text-sm leading-relaxed lg:max-w-sm">
							{tierTagline}
						</p>
					</div>

					<div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
						<PlanStatusBadge status={subscriptionStatus} />
						{intervalLabel ? (
							<span className="text-muted-foreground text-sm">
								{intervalLabel}
							</span>
						) : null}
					</div>

					<div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
						<button
							ref={flipControlRef}
							type="button"
							aria-pressed={flipped}
							aria-controls="me-subscription-identity-card"
							className={cn(
								"inline-flex min-h-11 items-center rounded-full bg-card px-5 py-2 font-medium text-foreground text-sm",
								PRESSABLE_PILL_CLASS,
								"[@media(hover:hover)]:hover:bg-foreground/10",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							)}
							onClick={handleFlipToggle}
						>
							<span ref={flipLabelRef} className="t-text-swap inline-block">
								{flipLabel}
							</span>
						</button>

						{showAttunedUpgrade ? (
							<Link
								href="/pricing#attuned"
								className={cn(
									"inline-flex h-11 items-center justify-center rounded-full bg-card px-6 font-medium text-foreground text-sm",
									PRESSABLE_PILL_CLASS,
									"[@media(hover:hover)]:hover:bg-card/80",
								)}
							>
								Upgrade to Attuned
							</Link>
						) : null}
						{showImmersedUpgrade ? (
							<Link
								href="/pricing#immersed"
								className={cn(
									"inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background text-sm",
									PRESSABLE_PILL_CLASS,
									"[@media(hover:hover)]:hover:bg-foreground/90",
								)}
							>
								Upgrade to Immersed
							</Link>
						) : null}
					</div>
				</aside>
			</div>
		</div>
	);
}

function CardFaces({
	flipped,
	frontFaceRef,
	backFaceRef,
	handle,
	name,
	tierLabel,
	subscriptionTier,
	planOverride,
	subscriptionStatus,
	intervalLabel,
	canManagePolarBilling,
	portalLoading,
	onManage,
	manageButtonRef,
}: {
	flipped: boolean;
	frontFaceRef: RefObject<HTMLDivElement | null>;
	backFaceRef: RefObject<HTMLDivElement | null>;
	handle: string;
	name: string;
	tierLabel: string;
	subscriptionTier: PlanTierId;
	planOverride: PlanTierId | null;
	subscriptionStatus: SubscriptionBillingStatus;
	intervalLabel: string | null;
	canManagePolarBilling: boolean;
	portalLoading: boolean;
	onManage: () => void;
	manageButtonRef: RefObject<HTMLButtonElement | null>;
}) {
	return (
		<>
			{/* Identity face — foil + duotone tile; no plan aura. */}
			<HoloMembershipFace
				ref={frontFaceRef}
				className={cn(
					HOLO_FACE_FILL_CLASS,
					"backface-hidden",
					!flipped ? "pointer-events-auto" : "pointer-events-none",
				)}
				style={HOLO_FACE_FILL_STYLE}
				aria-hidden={flipped}
			>
				<div className="flex items-start justify-between gap-3">
					{/* Tile sits where the portrait used to — CSS duotone, not Next Image. */}
					<HoloMembershipTile />
					<span className="font-semibold text-xs uppercase tracking-[0.18em] opacity-70">
						{APP_NAME}
					</span>
				</div>
				<div className="space-y-1.5">
					<p className="truncate font-semibold text-xl tracking-tight">
						{name}
					</p>
					<p className="truncate text-sm opacity-70">@{handle}</p>
					{/* Tier name only on the card — tagline lives in the companion rail. */}
					<p className="pt-2 font-medium text-sm">{tierLabel}</p>
				</div>
			</HoloMembershipFace>

			{/* Billing face — same foil print; content stays above laminate. */}
			<HoloMembershipFace
				ref={backFaceRef}
				className={cn(
					HOLO_FACE_FILL_CLASS,
					/* Compose flip + --rx/--ry via .holo-card--back — do not use a lone Tailwind transform. */
					"holo-card--back backface-hidden",
					flipped ? "pointer-events-auto" : "pointer-events-none",
				)}
				style={HOLO_FACE_FILL_STYLE}
				aria-hidden={!flipped}
			>
				<div className="flex items-start justify-between gap-3">
					<p className="font-semibold text-sm tracking-tight">Billing</p>
					<PlanStatusBadge status={subscriptionStatus} />
				</div>
				<div className="space-y-3">
					{intervalLabel ? (
						<p className="text-sm opacity-70">{intervalLabel}</p>
					) : null}
					{planOverride ? (
						<p className="text-sm leading-relaxed opacity-70">
							You have complimentary{" "}
							<span className="font-medium opacity-100">
								{SUBSCRIPTION_TIER_LABELS[planOverride]}
							</span>{" "}
							access from the {APP_NAME} team
							{subscriptionTier !== "still"
								? ` — your paid plan is ${SUBSCRIPTION_TIER_LABELS[subscriptionTier]}`
								: ""}
							.
						</p>
					) : null}
					{canManagePolarBilling ? (
						<button
							ref={manageButtonRef}
							type="button"
							className={cn(
								"inline-flex h-11 w-full items-center justify-center rounded-full bg-secondary px-6 font-medium text-secondary-foreground text-sm",
								PRESSABLE_PILL_CLASS,
								"[@media(hover:hover)]:hover:bg-secondary/80",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
							)}
							disabled={portalLoading}
							onClick={onManage}
						>
							{portalLoading ? "Opening portal…" : "Manage subscription"}
						</button>
					) : (
						<p className="text-sm leading-relaxed opacity-70">
							No paid subscription to manage.
						</p>
					)}
				</div>
			</HoloMembershipFace>
		</>
	);
}
