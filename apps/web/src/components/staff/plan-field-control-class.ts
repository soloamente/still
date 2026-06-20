import { cn } from "@still/ui/lib/utils";

/**
 * Staff plans form controls on `bg-card` shells — flat `bg-background` fields that
 * stay canvas-colored on focus. Avoid `focus-visible:bg-muted/*` (`--muted` ≈ `--card`).
 */
export function planFieldControlClass(extra?: string) {
	return cn(
		"h-11 w-full min-w-0 rounded-xl border-0 border-transparent bg-background px-3 text-base text-foreground shadow-none outline-none ring-0",
		"placeholder:text-muted-foreground/70",
		"focus-visible:border-0 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-0",
		"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
		"aria-invalid:border-destructive/40 aria-invalid:ring-0",
		"md:text-sm",
		extra,
	);
}
