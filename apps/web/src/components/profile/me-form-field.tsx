import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Flat `bg-card` controls on `bg-background` panels (Mobbin-style): no border
 * or focus ring chrome. `Input` / `Textarea` defaults add rings — we override
 * them here and neutralize `aria-invalid` rings so errors read from copy only.
 * Subtle lift on focus: `muted/32` reads clearly against both `bg-card` fields and the
 * `bg-background` settings panels without adding ring chrome.
 */
const fieldControlClass =
	"h-11 rounded-xl border-0 border-transparent bg-card px-3 text-base text-foreground shadow-none outline-none ring-0 focus-visible:border-0 focus-visible:bg-muted/32 focus-visible:outline-none focus-visible:ring-0 aria-invalid:border-destructive/40 aria-invalid:ring-0";

export function meFieldControlClass(extra?: string) {
	return cn(fieldControlClass, extra);
}

/** Label + control stack for account forms. */
export function MeFormField({
	id,
	label,
	hint,
	children,
	className,
}: {
	id: string;
	label: string;
	hint?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-2", className)}>
			<Label htmlFor={id} className="font-medium text-foreground text-sm">
				{label}
			</Label>
			{children}
			{hint ? (
				<p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
			) : null}
		</div>
	);
}
