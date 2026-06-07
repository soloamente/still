"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@still/ui/lib/utils";
import { useMemo } from "react";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
	className,
	positionerClassName,
	align = "center",
	side = "bottom",
	sideOffset = 8,
	positionMethod,
	initialFocus = false,
	children,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<
		PopoverPrimitive.Positioner.Props,
		"align" | "side" | "sideOffset" | "positionMethod"
	> & {
		initialFocus?: PopoverPrimitive.Popup.Props["initialFocus"];
		positionerClassName?: string;
	}) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				className={cn("isolate z-50 outline-none", positionerClassName)}
				align={align}
				side={side}
				sideOffset={sideOffset}
				positionMethod={positionMethod}
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					initialFocus={initialFocus}
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 max-h-(--available-height) origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-mobbin-3xl bg-background text-foreground shadow-mobbin-xl outline-none ring-0 duration-100 data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					{children}
				</PopoverPrimitive.Popup>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

/** Popover positioned to a viewport point (e.g. textarea `@` caret) — no trigger button. */
function PopoverAnchoredContent({
	anchor,
	className,
	positionerClassName,
	align = "start",
	side = "top",
	sideOffset = 8,
	positionMethod,
	initialFocus = false,
	children,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<
		PopoverPrimitive.Positioner.Props,
		"align" | "side" | "sideOffset" | "positionMethod"
	> & {
		anchor: { x: number; y: number; height?: number } | null;
		initialFocus?: PopoverPrimitive.Popup.Props["initialFocus"];
		positionerClassName?: string;
	}) {
	const virtualAnchor = useMemo(
		() => ({
			getBoundingClientRect: () => {
				const height = anchor?.height ?? 0;
				return new DOMRect(anchor?.x ?? 0, anchor?.y ?? 0, 0, height);
			},
		}),
		[anchor?.x, anchor?.y, anchor?.height],
	);

	if (!anchor) return null;

	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				className={cn("isolate z-50 outline-none", positionerClassName)}
				anchor={virtualAnchor}
				align={align}
				side={side}
				sideOffset={sideOffset}
				positionMethod={positionMethod}
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					initialFocus={initialFocus}
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 max-h-(--available-height) origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-mobbin-3xl bg-background text-foreground shadow-mobbin-xl outline-none ring-0 duration-100 data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					{children}
				</PopoverPrimitive.Popup>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverAnchoredContent, PopoverContent, PopoverTrigger };
