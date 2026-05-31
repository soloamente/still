import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";

/**
 * Guest CTA on public list pages — save lists and log titles after sign-in (ST.1 SEO).
 */
export function ListDetailPublicSignInCta({
	listId,
	className,
}: {
	listId: string;
	className?: string;
}) {
	const returnPath = `/l/${listId}`;
	const signInHref = `/sign-in?from=${encodeURIComponent(returnPath)}`;
	const signUpHref = "/sign-up";

	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-background px-5 py-5 text-center",
				className,
			)}
		>
			<p className="text-balance font-medium text-foreground text-sm leading-snug">
				Join {APP_NAME} to like this list, log what you have watched, and build
				your taste profile.
			</p>
			<div className="flex w-full flex-wrap items-center justify-center gap-2">
				<Link
					href={signUpHref}
					className={cn(
						buttonVariants({ variant: "default", size: "pill" }),
						"min-w-[7.5rem]",
					)}
				>
					Sign up
				</Link>
				<Link
					href={signInHref}
					className={cn(
						buttonVariants({ variant: "outline", size: "pill" }),
						"min-w-[7.5rem] bg-card",
					)}
				>
					Sign in
				</Link>
			</div>
		</div>
	);
}
