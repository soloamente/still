import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";

/** Sense wordmark in a raised card pill — not the old three-dot glass mark. */
export function LandingMarkPill({
	className,
	href = "/",
}: {
	className?: string;
	href?: string;
}) {
	return (
		<Link
			href={href}
			aria-label={`${APP_NAME} — home`}
			className={cn(
				"inline-flex h-11 min-w-11 select-none items-center justify-center rounded-full bg-card px-4 font-sans font-semibold text-foreground text-sm",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				className,
			)}
		>
			{APP_NAME}
		</Link>
	);
}
