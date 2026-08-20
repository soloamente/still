import { cn } from "@still/ui/lib/utils";

/** Nucleo UI plus 18px — expand affordance on a closed FAQ row. */
export function PricingFaqPlusIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 18 18"
			aria-hidden="true"
			focusable="false"
			className={cn("shrink-0", className)}
		>
			<line
				x1="9"
				y1="3.25"
				x2="9"
				y2="14.75"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.5"
			/>
			<line
				x1="3.25"
				y1="9"
				x2="14.75"
				y2="9"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

/** Nucleo UI minus 18px — collapse affordance on an open FAQ row. */
export function PricingFaqMinusIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 18 18"
			aria-hidden="true"
			focusable="false"
			className={cn("shrink-0", className)}
		>
			<line
				x1="3.25"
				y1="9"
				x2="14.75"
				y2="9"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.5"
			/>
		</svg>
	);
}
