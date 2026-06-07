"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import {
	type ComponentPropsWithoutRef,
	type ReactNode,
	useEffect,
	useState,
} from "react";

/** Read `--modal-close-dur` so JS unmount stays in sync with CSS. */
function parseModalCloseMs(): number {
	if (typeof document === "undefined") return 150;
	const raw = getComputedStyle(document.documentElement).getPropertyValue(
		"--modal-close-dur",
	);
	const parsed = Number.parseFloat(raw);
	return Number.isFinite(parsed) ? parsed : 150;
}

type TransitionsModalLayerProps = {
	open: boolean;
	onClose: () => void;
	/** Fires after the close animation finishes and the layer unmounts. */
	onClosed?: () => void;
	children: ReactNode;
	dialogClassName?: string;
	backdropClassName?: string;
} & Pick<
	ComponentPropsWithoutRef<"div">,
	"role" | "aria-modal" | "aria-labelledby" | "aria-describedby"
>;

/**
 * transitions.dev modal shell — scale open/close via `.t-modal` tokens in globals.css.
 */
export function TransitionsModalLayer({
	open,
	onClose,
	onClosed,
	children,
	dialogClassName,
	backdropClassName,
	role = "dialog",
	"aria-modal": ariaModal = true,
	"aria-labelledby": ariaLabelledby,
	"aria-describedby": ariaDescribedby,
}: TransitionsModalLayerProps) {
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(open);
	const [panelOpen, setPanelOpen] = useState(false);
	const [closing, setClosing] = useState(false);

	useEffect(() => {
		if (open) {
			setMounted(true);
			setClosing(false);
			const frame = requestAnimationFrame(() => setPanelOpen(true));
			return () => cancelAnimationFrame(frame);
		}

		if (!mounted) return;

		setPanelOpen(false);
		setClosing(true);
		const closeMs = reduceMotion ? 0 : parseModalCloseMs();
		const timer = window.setTimeout(() => {
			setMounted(false);
			setClosing(false);
			onClosed?.();
		}, closeMs);

		return () => window.clearTimeout(timer);
	}, [open, mounted, onClosed, reduceMotion]);

	if (!mounted) return null;

	return (
		<div className="fixed inset-0 z-50 grid place-items-end md:place-items-center">
			<button
				type="button"
				aria-label="Close dialog"
				className={cn(
					"absolute inset-0 bg-absolute-black/82 backdrop-blur-sm",
					"transition-opacity ease-[var(--modal-ease)] motion-reduce:transition-none",
					panelOpen && !closing
						? "pointer-events-auto opacity-100 duration-[var(--modal-open-dur)]"
						: "pointer-events-none opacity-0 duration-[var(--modal-close-dur)]",
					backdropClassName,
				)}
				onClick={onClose}
			/>
			{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role defaults to dialog; callers may pass other roles without aria-modal. */}
			<div
				role={role}
				aria-modal={role === "dialog" ? ariaModal : undefined}
				aria-labelledby={ariaLabelledby}
				aria-describedby={ariaDescribedby}
				className={cn(
					"relative z-10",
					"t-modal",
					panelOpen && !closing && "is-open",
					closing && "is-closing",
					dialogClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}
