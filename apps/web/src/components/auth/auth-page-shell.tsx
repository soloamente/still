"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { AuthBackgroundCarousel } from "@/components/auth/auth-background-carousel";
import { AuthLegalDrawerProvider } from "@/components/auth/auth-legal-drawer";
import { AuthLegalNav } from "@/components/auth/auth-legal-nav";
import { AuthRouteSlide } from "@/components/auth/auth-route-slide";
import { AuthSessionRedirect } from "@/components/auth/auth-session-redirect";
import { BrandMark } from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";
import { VAUL_DRAWER_WRAPPER_ATTR } from "@/lib/detail-vaul-drawer";
import { useTextStateSwap } from "@/lib/text-state-swap";

function AuthBackdropTitle({
	title,
	tone,
}: {
	title: string;
	tone: "on-still" | "on-card";
}) {
	const titleRef = useTextStateSwap(title);

	if (!title) return null;

	return (
		<p
			className={cn(
				"font-medium text-sm tracking-tight",
				tone === "on-still"
					? "text-white [text-shadow:0_1px_10px_rgb(0_0_0/0.55)]"
					: "text-muted-foreground",
			)}
		>
			<span ref={titleRef} className="t-text-swap">
				{title}
			</span>
		</p>
	);
}

/**
 * Full-bleed auth chrome: carousel, wordmark, floating panel. Content uses a CSS enter
 * (transform-only) on first paint; route swaps slide the convert-card body via
 * transitions.dev page side-by-side (`AuthRouteSlide`) so the panel stays mounted.
 */
export function AuthPageShell({
	routeKey,
	title,
	description,
	children,
	footer,
	className,
}: {
	/** Pathname key for slide direction (e.g. `/sign-in` → `/sign-up`). */
	routeKey: string;
	title: string;
	description: string;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const { data: session, isPending } = authClient.useSession();
	const [backdropTitle, setBackdropTitle] = useState("");

	// iOS Safari: stop rubber-band scroll exposing the body canvas past the backdrop.
	useEffect(() => {
		const html = document.documentElement;
		const body = document.body;
		const prevHtmlOverflow = html.style.overflow;
		const prevBodyOverflow = body.style.overflow;

		html.style.overflow = "hidden";
		body.style.overflow = "hidden";

		return () => {
			html.style.overflow = prevHtmlOverflow;
			body.style.overflow = prevBodyOverflow;
		};
	}, []);

	// Hide the auth chrome once we know the patron is signed in, but keep
	// `AuthSessionRedirect` mounted — an early `return null` here prevented the
	// redirect effect from ever running, leaving `/sign-in` permanently blank.
	if (!isPending && session) {
		return <AuthSessionRedirect />;
	}

	// Title + form + account footer ride the page-slide; legal stays pinned to the
	// card floor so the form centers in the space above it.
	const routeContent = (
		<div className="flex w-full min-w-0 flex-col space-y-8">
			<header className="flex flex-col gap-2 text-balance text-center">
				<h1 className="font-semibold text-4xl text-foreground leading-none">
					{title}
				</h1>
				<p className="text-pretty font-normal text-muted-foreground text-sm">
					{description}
				</p>
			</header>

			<div className="min-w-0">{children}</div>

			{footer ? (
				<footer className="text-center text-muted-foreground text-sm">
					{footer}
				</footer>
			) : null}
		</div>
	);

	return (
		<AuthLegalDrawerProvider>
			<AuthSessionRedirect />
			{/* Vaul scales this wrapper under the legal drawer scrim — keep the still. */}
			<div {...{ [VAUL_DRAWER_WRAPPER_ATTR]: "" }}>
				{/* lvh (not inset-0/dvh) — largest viewport so Safari chrome never letterboxes the stills. */}
				<div
					aria-hidden
					className="pointer-events-none fixed top-[calc(-1*env(safe-area-inset-top,0px))] left-0 z-0 h-[calc(100lvh+env(safe-area-inset-top,0px))] min-h-[calc(100lvh+env(safe-area-inset-top,0px))] w-full md:inset-0 md:top-0 md:h-auto md:min-h-dvh"
				>
					<AuthBackgroundCarousel
						className="absolute inset-0 size-full"
						onActiveTitleChange={setBackdropTitle}
					/>
				</div>
				<main
					aria-label="Authentication"
					className={cn(
						"relative z-10 flex w-full max-w-[100vw] overflow-x-hidden bg-transparent font-sans antialiased",
						// Card inset only — backdrop stays full-bleed in the fixed layer above.
						"max-md:fixed max-md:inset-0 max-md:flex max-md:flex-col max-md:overflow-hidden max-md:p-2.5",
						"md:min-h-dvh md:items-center md:justify-end md:p-2.5",
						className,
					)}
				>
					<div className="absolute isolate z-10 flex max-w-[calc(100%-1.25rem)] items-center max-md:pointer-events-none max-md:top-[max(1rem,env(safe-area-inset-top))] max-md:left-1/2 max-md:-translate-x-1/2 max-md:justify-center md:pointer-events-auto md:top-6 md:left-6 md:translate-x-0 md:justify-start">
						<BrandMark href="/" size="lg" tone="inverse" wordmarkFont="sans" />
					</div>

					{/* Film title on the still; Privacy / Terms live on the convert card. */}
					<div className="pointer-events-none absolute bottom-6 left-6 z-10 hidden max-w-[min(28rem,calc(50%-3rem))] md:block">
						<AuthBackdropTitle title={backdropTitle} tone="on-still" />
					</div>

					<div className="relative isolate z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col items-center overflow-hidden rounded-[2rem] bg-card font-medium shadow-lg md:h-[calc(100dvh-1.25rem)] md:w-1/2 md:max-w-[50%] md:flex-none">
						{/* Form centers in the remaining height; legal reserves the floor. */}
						<div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain p-8 max-md:px-6 max-md:pt-[max(5rem,calc(env(safe-area-inset-top)+3.5rem))] max-md:pb-4">
							<div className="mx-auto w-full min-w-0 max-w-md">
								{/* CSS enter (not Motion opacity) — direct /sign-in on mobile stayed invisible after useSession re-render. */}
								<div
									className={cn(
										"w-full min-w-0",
										!reduceMotion && "auth-page-content-enter",
									)}
								>
									<AuthRouteSlide routeKey={routeKey}>
										{routeContent}
									</AuthRouteSlide>
								</div>
							</div>
						</div>
						<div className="flex shrink-0 flex-col items-center gap-2 px-8 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
							<div className="md:hidden">
								<AuthBackdropTitle title={backdropTitle} tone="on-card" />
							</div>
							<AuthLegalNav className="justify-center text-muted-foreground" />
						</div>
					</div>
				</main>
			</div>
		</AuthLegalDrawerProvider>
	);
}
