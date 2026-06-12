"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { AuthBackgroundCarousel } from "@/components/auth/auth-background-carousel";
import { AuthSessionRedirect } from "@/components/auth/auth-session-redirect";
import { BrandMark } from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";

/**
 * Full-bleed auth chrome: carousel, wordmark, floating panel. Content uses a CSS enter
 * (transform-only) on first paint; sign-in ↔ sign-up swaps instantly (shared layout).
 */
export function AuthPageShell({
	title,
	description,
	children,
	footer,
	className,
}: {
	title: string;
	description: string;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const { data: session, isPending } = authClient.useSession();

	if (!isPending && session) {
		return null;
	}

	const routeContent = (
		<>
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
		</>
	);

	return (
		<>
			<AuthSessionRedirect />
			<main
				aria-label="Authentication"
				className={cn(
					"relative flex min-h-dvh w-full max-w-[100vw] items-center justify-center overflow-x-hidden p-2.5 font-sans antialiased md:justify-end",
					className,
				)}
			>
				<AuthBackgroundCarousel className="z-0" />

				<div className="absolute isolate z-10 flex max-w-[calc(100%-1.25rem)] items-center max-md:pointer-events-none max-md:top-14 max-md:left-1/2 max-md:-translate-x-1/2 max-md:justify-center md:pointer-events-auto md:top-6 md:left-6 md:translate-x-0 md:justify-start">
					<BrandMark href="/" size="lg" wordmarkFont="sans" />
				</div>

				<div className="relative isolate z-10 flex h-[calc(100dvh-1.25rem)] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-card font-medium shadow-lg md:w-1/2 md:max-w-[50%]">
					<div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain p-8">
						<div className="mx-auto w-full min-w-0 max-w-md">
							{/* CSS enter (not Motion opacity) — direct /sign-in on mobile stayed invisible after useSession re-render. */}
							<div
								className={cn(
									"flex w-full min-w-0 flex-col space-y-8",
									!reduceMotion && "auth-page-content-enter",
								)}
							>
								{routeContent}
							</div>
						</div>
					</div>
				</div>
			</main>
		</>
	);
}
