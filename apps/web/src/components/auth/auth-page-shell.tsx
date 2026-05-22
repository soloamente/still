"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { AuthBackgroundCarousel } from "@/components/auth/auth-background-carousel";
import { BrandMark } from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";

const AUTH_PAGE_LOAD_EASE = [0.22, 1, 0.36, 1] as const;

/** One compositor-friendly enter (opacity + transform). No blur/stagger — those caused jank. */
const AUTH_PAGE_CONTENT_LOAD = {
	initial: { opacity: 0, transform: "translateY(8px) scale(0.98)" },
	animate: {
		opacity: 1,
		transform: "translateY(0px) scale(1)",
	},
	transition: { duration: 0.38, ease: AUTH_PAGE_LOAD_EASE },
} as const;

/**
 * Full-bleed auth chrome: carousel, wordmark, floating panel. Content fades in on first load
 * only; sign-in ↔ sign-up swaps instantly (shared layout keeps one shell instance).
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
	const router = useRouter();
	const searchParams = useSearchParams();
	const reduceMotion = useReducedMotion();
	const { data: session, isPending } = authClient.useSession();
	// Honor `?from=/home` after sign-in so we do not fight the sign-in form redirect.
	const redirectTo = (() => {
		const from = searchParams.get("from");
		return typeof from === "string" && from.startsWith("/") ? from : "/home";
	})();
	useEffect(() => {
		if (isPending) return;
		if (session) {
			router.replace(redirectTo);
		}
	}, [isPending, redirectTo, router, session]);

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
						{reduceMotion ? (
							<div className="flex w-full min-w-0 flex-col space-y-8">
								{routeContent}
							</div>
						) : (
							<motion.div
								animate={AUTH_PAGE_CONTENT_LOAD.animate}
								className="flex w-full min-w-0 flex-col space-y-8"
								initial={AUTH_PAGE_CONTENT_LOAD.initial}
								transition={AUTH_PAGE_CONTENT_LOAD.transition}
							>
								{routeContent}
							</motion.div>
						)}
					</div>
				</div>
			</div>
		</main>
	);
}
