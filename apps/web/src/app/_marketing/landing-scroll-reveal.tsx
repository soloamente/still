import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/** Static wrapper — La Nube pacing uses whitespace, not scroll gimmicks. */
export function LandingScrollReveal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
}) {
	return <div className={cn(className)}>{children}</div>;
}
