"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@still/ui/lib/utils";
import {
	type MouseEvent,
	type ReactNode,
	useCallback,
	useMemo,
	useState,
} from "react";

function ContextMenuRoot({
	open,
	onOpenChange,
	anchor,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	anchor: { x: number; y: number } | null;
	children: ReactNode;
}) {
	const virtualAnchor = useMemo(
		() => ({
			getBoundingClientRect: () =>
				new DOMRect(anchor?.x ?? 0, anchor?.y ?? 0, 0, 0),
		}),
		[anchor?.x, anchor?.y],
	);

	return (
		<MenuPrimitive.Root
			data-slot="context-menu"
			open={open}
			onOpenChange={onOpenChange}
		>
			{anchor ? (
				<MenuPrimitive.Portal>
					<MenuPrimitive.Positioner
						className="isolate z-50 outline-none"
						anchor={virtualAnchor}
						side="bottom"
						align="start"
						sideOffset={6}
					>
						<MenuPrimitive.Popup
							data-slot="context-menu-content"
							className={cn(
								"z-50 max-h-(--available-height) w-auto min-w-36 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-[2rem] bg-popover text-popover-foreground opacity-0 shadow-mobbin-xl outline-none ring-1 ring-foreground/10 transition-opacity duration-150 ease-out data-closed:overflow-hidden data-ending-style:opacity-0 data-open:opacity-100 data-starting-style:opacity-0 motion-reduce:transition-none",
							)}
						>
							{children}
						</MenuPrimitive.Popup>
					</MenuPrimitive.Positioner>
				</MenuPrimitive.Portal>
			) : null}
		</MenuPrimitive.Root>
	);
}

/** Right-click anchor state — pair with `ContextMenuRoot` on the same surface. */
function useContextMenuAnchor() {
	const [open, setOpen] = useState(false);
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

	const onContextMenu = useCallback((event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setAnchor({ x: event.clientX, y: event.clientY });
		setOpen(true);
	}, []);

	const onOpenChange = useCallback((next: boolean) => {
		setOpen(next);
		if (!next) setAnchor(null);
	}, []);

	return { open, anchor, onContextMenu, onOpenChange };
}

function ContextMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) {
	return (
		<MenuPrimitive.Item
			data-slot="context-menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"group/context-menu-item relative flex cursor-pointer select-none items-center gap-2 rounded-none px-2 py-2 text-xs outline-hidden focus:bg-background focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground data-disabled:pointer-events-none data-inset:pl-7 data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive",
				className,
			)}
			{...props}
		/>
	);
}

function ContextMenuSeparator({
	className,
	...props
}: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot="context-menu-separator"
			className={cn("-mx-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export {
	ContextMenuItem,
	ContextMenuRoot,
	ContextMenuSeparator,
	useContextMenuAnchor,
};
