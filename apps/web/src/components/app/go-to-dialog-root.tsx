"use client";

import { cn } from "@still/ui/lib/utils";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
import { useGoToDialog } from "@/lib/go-to-dialog-store";
import { filterGoToShortcuts } from "@/lib/search-go-to-shortcuts";

/**
 * Compact navigation launcher — ⌘⇧K. Kept separate from catalog search so ⌘K
 * stays short (films/TV/people) without a long “Go to” list on open.
 */
export function GoToDialogRoot() {
	const { isOpen, close } = useGoToDialog();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		if (!isOpen) setQuery("");
	}, [isOpen]);

	/** Global shortcut — compact launcher separate from ⌘K catalog search. */
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (
				!(event.metaKey || event.ctrlKey) ||
				!event.shiftKey ||
				event.key.toLowerCase() !== "k"
			) {
				return;
			}
			event.preventDefault();
			useCatalogSearchDialog.getState().requestClose();
			useGoToDialog.getState().toggle();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const shortcuts = useMemo(() => filterGoToShortcuts(query), [query]);

	const navigate = (href: string) => {
		router.push(href);
		close();
	};

	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
					className="modal-overlay-scrim fixed inset-0 z-[60] grid place-items-start bg-absolute-black/70 backdrop-blur-sm"
					onClick={close}
				>
					<motion.div
						role="dialog"
						aria-label="Go to"
						initial={
							reduceMotion
								? { opacity: 1, y: 0, scale: 1 }
								: { opacity: 0, y: -6, scale: 0.98 }
						}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={
							reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }
						}
						transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
						onClick={(e) => e.stopPropagation()}
						className="mx-auto mt-[14vh] w-[min(92vw,22rem)] overflow-hidden rounded-2xl bg-surface-overlay shadow-[0_24px_80px_rgba(5,5,8,0.55)]"
					>
						<Command
							label="Go to"
							shouldFilter={false}
							onKeyDown={(e) => {
								if (e.key === "Escape") close();
							}}
						>
							<div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
								<Search
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<Command.Input
									autoFocus
									value={query}
									onValueChange={setQuery}
									placeholder="Go to…"
									className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
								/>
								<kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground tracking-wide">
									esc
								</kbd>
							</div>
							<Command.List className="max-h-[min(50vh,20rem)] overflow-y-auto p-2">
								{shortcuts.length > 0 ? (
									<div className="grid grid-cols-2 gap-1">
										{shortcuts.map((s) => (
											<Command.Item
												key={s.id}
												value={s.id}
												onSelect={() => navigate(s.href)}
												className={cn(
													"flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center outline-none",
													"text-foreground aria-selected:bg-background",
													"[@media(hover:hover)]:hover:bg-background",
												)}
											>
												<s.icon
													className="size-5 shrink-0 text-muted-foreground"
													aria-hidden
												/>
												<span className="w-full truncate font-medium text-xs leading-tight">
													{s.label}
												</span>
											</Command.Item>
										))}
									</div>
								) : (
									<p className="px-3 py-6 text-center text-muted-foreground text-sm">
										No matches
									</p>
								)}
							</Command.List>
						</Command>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
