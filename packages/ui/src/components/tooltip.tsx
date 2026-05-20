"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@still/ui/lib/utils";

function TooltipProvider({ ...props }: TooltipPrimitive.Provider.Props) {
	return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	side = "top",
	sideOffset = 8,
	align = "center",
	children,
	...props
}: TooltipPrimitive.Popup.Props &
	Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				className="z-[60] outline-none"
			>
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						// Inverted ink so tooltips don't read like `bg-background` inputs or `bg-card` sheets.
						"w-fit max-w-[16rem] text-balance rounded-xl bg-foreground px-3 py-2 text-center text-background text-xs leading-snug shadow-mobbin-xl outline-none ring-0",
						className,
					)}
					{...props}
				>
					{children}
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
