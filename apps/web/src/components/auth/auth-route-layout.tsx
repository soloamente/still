"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

const AUTH_ROUTES = {
	"/sign-in": {
		title: "Welcome back",
		description: "Pick up your diary where you left off.",
		footer: (
			<>
				New to Still?{" "}
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					href="/sign-up"
				>
					Create an account
				</Link>
			</>
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
} as const;

/**
 * Shared auth layout: one `AuthPageShell` instance across sign-in ↔ sign-up so the
 * floating panel does not re-enter (and overflow the viewport) on every link click.
 */
export function AuthRouteLayout({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const route =
		pathname === "/sign-up" ? AUTH_ROUTES["/sign-up"] : AUTH_ROUTES["/sign-in"];

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
