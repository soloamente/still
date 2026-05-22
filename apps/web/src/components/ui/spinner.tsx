import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * Compact inline spinner for submit buttons and small loading slots.
 * Keeps size stable so label ↔ spinner swaps do not shift layout.
 */
export function Spinner({
	className,
	size = 16,
	...props
}: React.ComponentProps<typeof Loader2> & { size?: number }) {
	return (
		<Loader2
			role="status"
			aria-label="Loading"
			size={size}
			className={cn("animate-spin", className)}
			{...props}
		/>
	);
}
