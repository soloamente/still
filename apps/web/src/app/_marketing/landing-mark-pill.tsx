import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { LANDING_GLASS_PILL } from "./landing-glass";

/** La Nube logo disc — three-dot mark as soft circles, not a single accent lamp. */
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
			aria-label="Still — home"
			className={cn(
				LANDING_GLASS_PILL,
				"flex size-11 shrink-0 items-center justify-center gap-[3px] transition-colors duration-200 [@media(hover:hover)]:bg-white/[0.14]",
				className,
			)}
		>
			<span aria-hidden className="size-1.5 rounded-full bg-foreground/90" />
			<span aria-hidden className="size-1.5 rounded-full bg-foreground/70" />
			<span aria-hidden className="size-1.5 rounded-full bg-foreground/50" />
		</Link>
	);
}
