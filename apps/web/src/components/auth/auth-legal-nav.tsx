"use client";

import { cn } from "@still/ui/lib/utils";

import { useAuthLegalDrawer } from "@/components/auth/auth-legal-drawer";

const LEGAL_LINK_CLASS =
	"underline-offset-4 [@media(hover:hover)]:hover:underline";

/**
 * Privacy / Terms for the convert card — opens the legal Vaul over auth chrome
 * so the still stays under the scrim (full `/privacy` navigation wiped it).
 */
export function AuthLegalNav({ className }: { className?: string }) {
	const { openPolicy } = useAuthLegalDrawer();

	return (
		<nav
			aria-label="Legal"
			className={cn("flex flex-wrap items-center gap-x-1 text-xs", className)}
		>
			<button
				type="button"
				className={LEGAL_LINK_CLASS}
				onClick={() => openPolicy("privacy")}
			>
				Privacy
			</button>
			<span aria-hidden> - </span>
			<button
				type="button"
				className={LEGAL_LINK_CLASS}
				onClick={() => openPolicy("terms")}
			>
				Terms
			</button>
		</nav>
	);
}
