"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { APP_NAME } from "@/lib/app-brand";

const AUTH_ROUTES = {
	"/sign-in": {
		title: "Welcome back",
		description: "Pick up your diary where you left off.",
		footer: (
			<div className="flex flex-col gap-2">
				<p>
					New to {APP_NAME}?{" "}
					<Link
						className="font-medium text-foreground underline-offset-4 hover:underline"
						href="/sign-up"
					>
						Create an account
					</Link>
				</p>
				<p>
					<Link
						className="font-medium text-foreground underline-offset-4 hover:underline"
						href="/forgot-password"
					>
						Forgot password?
					</Link>
				</p>
			</div>
		),
	},
	"/sign-up": {
		title: "Start your diary",
		description:
			"Log every film. Build lists. Find people whose taste sharpens yours.",
		footer: (
			<>
				Already have an account?{" "}
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					href="/sign-in"
				>
					Sign in
				</Link>
			</>
		),
	},
	"/forgot-password": {
		title: "Forgot your password?",
		description: "We'll email you a link to set a new password.",
		footer: (
			<>
				Remember your password?{" "}
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					href="/sign-in"
				>
					Sign in
				</Link>
			</>
		),
	},
	"/reset-password": {
		title: "Choose a new password",
		description: "Enter a new password for your account.",
		footer: (
			<>
				Need a new link?{" "}
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					href="/forgot-password"
				>
					Request reset email
				</Link>
			</>
		),
	},
} as const;

type AuthRouteKey = keyof typeof AUTH_ROUTES;

/** Resolve shell copy from pathname; unknown auth paths fall back to sign-in. */
function resolveAuthRoute(pathname: string) {
	if (pathname in AUTH_ROUTES) {
		return AUTH_ROUTES[pathname as AuthRouteKey];
	}
	return AUTH_ROUTES["/sign-in"];
}

/**
 * Shared auth layout: one `AuthPageShell` instance across sign-in ↔ sign-up so the
 * floating panel does not re-enter (and overflow the viewport) on every link click.
 */
export function AuthRouteLayout({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const route = resolveAuthRoute(pathname);

	return (
		<AuthPageShell
			description={route.description}
			footer={route.footer}
			title={route.title}
		>
			{children}
		</AuthPageShell>
	);
}
