"use client";

import { cn } from "@still/ui/lib/utils";
import { UserRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import { OnboardingLetterReveal } from "@/components/onboarding/onboarding-letter-reveal";
import type { OnboardingMovie, WizardStep } from "@/lib/onboarding-types";

const PROFILE_BANNER_ACCENT = "#c45c26";

/** Decorative preview pan/zoom — reference uses ~300ms ease-out-quad. */
const PREVIEW_MOTION_TRANSITION = {
	duration: 0.3,
	ease: [0.25, 0.46, 0.45, 0.94] as const,
};

const FIELD_OPACITY_MS = 400;

type OnboardingPreviewPanelProps = {
	step: WizardStep;
	displayName: string;
	handle: string;
	bio: string;
	avatarPreviewUrl: string | null;
	favorites: OnboardingMovie[];
	tasteHeadline: string | null;
	isTypingName?: boolean;
	isTypingHandle?: boolean;
	isTypingBio?: boolean;
};

type PreviewMotion = {
	y: number;
	scale: number;
};

function previewMotionForStep(
	step: WizardStep,
	hasAvatar: boolean,
	isTypingName: boolean,
	isTypingHandle: boolean,
	isTypingBio: boolean,
): PreviewMotion {
	switch (step) {
		case "welcome":
			return { y: 0, scale: 1.05 };
		case "avatar":
			return hasAvatar ? { y: -88, scale: 1.75 } : { y: -40, scale: 1.2 };
		case "name":
			return isTypingName ? { y: -120, scale: 1.55 } : { y: -72, scale: 1.25 };
		case "handle":
			return isTypingHandle
				? { y: -148, scale: 1.65 }
				: { y: -96, scale: 1.35 };
		case "bio":
			return isTypingBio ? { y: -200, scale: 1.75 } : { y: -128, scale: 1.45 };
		case "verify":
			return { y: -96, scale: 1.25 };
		case "favorites":
			return { y: -168, scale: 1.5 };
		case "done":
			return { y: -176, scale: 1.4 };
		default:
			return { y: 0, scale: 1.05 };
	}
}

function fieldOpacity(step: WizardStep, activeStep: WizardStep): string {
	// After identity setup, email verify should show the profile preview at full strength.
	if (step === "verify" && activeStep !== "welcome") {
		return "opacity-100";
	}
	return step === activeStep ? "opacity-100" : "opacity-10";
}

function PreviewEdgeScrims() {
	return (
		<>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-linear-to-b from-45% from-card to-transparent"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-36 bg-linear-to-t from-55% from-card to-transparent"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-y-0 right-0 z-20 w-36 bg-linear-to-l from-65% from-card to-transparent"
			/>
		</>
	);
}

/** Mirrors `ProfileStatCell` shell for the live preview. */
function PreviewStatPlaceholder({
	label,
	active,
}: {
	label: string;
	active: boolean;
}) {
	return (
		<div
			className={cn(
				"flex min-h-10 min-w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-xl bg-background px-3 py-2.5",
				active ? "opacity-100" : "opacity-30",
			)}
			style={{ transition: `opacity ${FIELD_OPACITY_MS}ms ease` }}
		>
			<span className="font-semibold text-foreground text-sm tabular-nums">
				0
			</span>
			<span className="text-[10px] text-muted-foreground">{label}</span>
		</div>
	);
}

function PreviewPortrait({
	avatarPreviewUrl,
	step,
}: {
	avatarPreviewUrl: string | null;
	step: WizardStep;
}) {
	const portraitShell = cn(
		"relative aspect-[2/3] w-[5.5rem] overflow-hidden rounded-2xl bg-muted/30 ring-4 ring-card sm:w-24",
		fieldOpacity(step, "avatar"),
	);

	return (
		<div className="mx-auto mb-4 flex justify-center">
			<AnimatePresence mode="wait">
				{avatarPreviewUrl ? (
					<motion.div
						key="avatar-image"
						animate={{ opacity: 1, scale: 1 }}
						className={portraitShell}
						exit={{ opacity: 0, scale: 0.92 }}
						initial={{ opacity: 0, scale: 0.92 }}
						transition={PREVIEW_MOTION_TRANSITION}
					>
						<Image
							alt=""
							className="size-full object-cover"
							height={288}
							src={avatarPreviewUrl}
							unoptimized
							width={192}
						/>
					</motion.div>
				) : (
					<motion.div
						key="avatar-placeholder"
						animate={{ opacity: 1, scale: 1 }}
						className={cn(
							portraitShell,
							"flex items-center justify-center",
							fieldOpacity(step, "avatar"),
						)}
						exit={{ opacity: 0, scale: 0.92 }}
						initial={{ opacity: 0, scale: 0.92 }}
						transition={PREVIEW_MOTION_TRANSITION}
					>
						<UserRound
							aria-hidden
							className="size-10 stroke-[1.25] text-muted-foreground sm:size-12"
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function PreviewFavoritesRow({ favorites }: { favorites: OnboardingMovie[] }) {
	if (!favorites.length) return null;

	return (
		<div className="mt-4 flex flex-wrap justify-center gap-2">
			<AnimatePresence mode="popLayout">
				{favorites.map((movie) => (
					<motion.div
						key={movie.id}
						animate={{ opacity: 1, scale: 1 }}
						className="relative aspect-2/3 w-14 overflow-hidden rounded-xl bg-muted/30"
						exit={{ opacity: 0, scale: 0.9 }}
						initial={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
					>
						{movie.poster_url ? (
							<Image
								alt={movie.title}
								className="size-full object-cover"
								height={84}
								src={movie.poster_url}
								unoptimized
								width={56}
							/>
						) : (
							<div className="size-full bg-muted" />
						)}
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}

/**
 * Desktop live profile preview — mirrors `ProfilePatronHeader` layout.
 * Hidden during quick-rate (wizard owns the full width).
 */
export function OnboardingPreviewPanel({
	step,
	displayName,
	handle,
	bio,
	avatarPreviewUrl,
	favorites,
	tasteHeadline,
	isTypingName = false,
	isTypingHandle = false,
	isTypingBio = false,
}: OnboardingPreviewPanelProps) {
	const reduceMotion = useReducedMotion();

	if (step === "taste" || step === "favorites") return null;

	const motionTarget = previewMotionForStep(
		step,
		Boolean(avatarPreviewUrl),
		isTypingName,
		isTypingHandle,
		isTypingBio,
	);
	const showFavorites = step === "done" && favorites.length > 0;
	const showBio =
		bio.trim().length > 0 ||
		step === "bio" ||
		step === "done" ||
		step === "verify";

	return (
		<div className="relative flex size-full items-center justify-center overflow-hidden">
			<PreviewEdgeScrims />

			<motion.div
				animate={
					reduceMotion
						? { y: 0, scale: 1 }
						: { y: motionTarget.y, scale: motionTarget.scale }
				}
				className="relative z-0 w-[640px] shrink-0 overflow-hidden rounded-3xl bg-card px-6 pt-6 pb-8 sm:px-8"
				style={{ transformOrigin: "center top" }}
				transition={reduceMotion ? { duration: 0 } : PREVIEW_MOTION_TRANSITION}
			>
				<header className="relative shrink-0">
					{/* Banner — parity with profile patron header */}
					<div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted/25">
						<div
							aria-hidden
							className="size-full"
							style={{
								background: `linear-gradient(120deg, ${PROFILE_BANNER_ACCENT}44, transparent 55%), var(--card)`,
							}}
						/>
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/90 via-card/20 to-transparent"
						/>
					</div>

					{/* Overlapping identity block — centered like `/profile/[handle]` */}
					<div className="relative mx-auto -mt-14 max-w-lg px-2 text-center sm:-mt-16 sm:px-4">
						<PreviewPortrait avatarPreviewUrl={avatarPreviewUrl} step={step} />

						{displayName.trim() ? (
							<h1
								className={cn(
									"text-balance font-semibold text-foreground text-xl sm:text-2xl",
									fieldOpacity(step, "name"),
								)}
								style={{
									transition: `opacity ${FIELD_OPACITY_MS}ms ease`,
								}}
							>
								<OnboardingLetterReveal
									active={step === "name"}
									text={displayName.trim()}
								/>
							</h1>
						) : (
							<div className="mx-auto h-7 w-48 rounded-md bg-muted/50" />
						)}

						{handle.trim() ? (
							<p
								className={cn(
									"mt-1 text-pretty text-muted-foreground text-sm",
									fieldOpacity(step, "handle"),
								)}
								style={{
									transition: `opacity ${FIELD_OPACITY_MS}ms ease`,
								}}
							>
								@
								<OnboardingLetterReveal
									active={step === "handle"}
									text={handle.trim()}
								/>
							</p>
						) : (
							<div className="mx-auto mt-1 h-5 w-36 rounded-sm bg-muted/40" />
						)}

						{step === "done" && tasteHeadline ? (
							<p className="mx-auto mt-4 max-w-prose text-pretty font-editorial text-muted-foreground text-sm leading-relaxed">
								{tasteHeadline}
							</p>
						) : (
							<div
								className={cn(
									"mx-auto mt-4 h-5 w-56 rounded-full bg-muted/40",
									step === "done" || step === "verify"
										? "opacity-100"
										: "opacity-20",
								)}
							/>
						)}

						<div
							className={cn(
								"mt-4 flex flex-wrap items-stretch justify-center gap-2",
								fieldOpacity(step, "welcome"),
							)}
							style={{
								transition: `opacity ${FIELD_OPACITY_MS}ms ease`,
							}}
						>
							<PreviewStatPlaceholder active={false} label="Films" />
							<PreviewStatPlaceholder active={false} label="Shows" />
							<PreviewStatPlaceholder active={false} label="Followers" />
							<PreviewStatPlaceholder active={false} label="Following" />
						</div>

						{showBio ? (
							<section
								aria-label="About preview"
								className={cn("mt-4 w-full", fieldOpacity(step, "bio"))}
								style={{
									transition: `opacity ${FIELD_OPACITY_MS}ms ease`,
								}}
							>
								{bio.trim() ? (
									<blockquote className="mx-auto max-w-prose text-balance">
										<p className="font-editorial text-foreground/90 text-sm leading-relaxed">
											<OnboardingLetterReveal
												active={step === "bio"}
												text={bio.trim()}
											/>
										</p>
									</blockquote>
								) : (
									<div className="mx-auto h-20 max-w-prose rounded-xl bg-muted/40" />
								)}
							</section>
						) : null}

						{showFavorites ? (
							<div
								className={fieldOpacity(step, "favorites")}
								style={{
									transition: `opacity ${FIELD_OPACITY_MS}ms ease`,
								}}
							>
								<PreviewFavoritesRow favorites={favorites} />
							</div>
						) : null}
					</div>
				</header>
			</motion.div>
		</div>
	);
}

const IDENTITY_STRIP_STEPS = new Set<WizardStep>([
	"welcome",
	"avatar",
	"name",
	"handle",
	"bio",
]);

/** Compact preview for mobile identity steps only. */
export function OnboardingPreviewStrip({
	step,
	displayName,
	handle,
	avatarPreviewUrl,
}: Pick<
	OnboardingPreviewPanelProps,
	"step" | "displayName" | "handle" | "avatarPreviewUrl"
>) {
	if (!IDENTITY_STRIP_STEPS.has(step)) return null;

	return (
		<div className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3">
			{avatarPreviewUrl ? (
				<div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-xl ring-2 ring-card">
					<Image
						alt=""
						className="size-full object-cover"
						height={60}
						src={avatarPreviewUrl}
						unoptimized
						width={40}
					/>
				</div>
			) : (
				<div className="flex aspect-[2/3] w-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 ring-2 ring-card">
					<UserRound aria-hidden className="size-4 text-muted-foreground" />
				</div>
			)}
			<div className="min-w-0 text-left">
				<p className="truncate font-semibold text-foreground text-sm">
					{displayName.trim() || "Your name"}
				</p>
				<p className="truncate text-muted-foreground text-xs">
					{handle.trim() ? `@${handle.trim()}` : "@handle"}
				</p>
			</div>
		</div>
	);
}
