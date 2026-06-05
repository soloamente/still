"use client";

import { cn } from "@still/ui/lib/utils";
import { usePathname } from "next/navigation";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import {
	meAccountNavIndex,
	resolveMeAccountNavPath,
} from "@/lib/me-account-nav";

type SlideLayer = {
	key: string;
	content: ReactNode;
	phase: "enter" | "exit";
};

/** transitions.dev page side-by-side — slide + blur between `/me/*` sidebar routes. */
export function MeAccountRouteTransition({
	children,
}: {
	children: ReactNode;
}) {
	const pathname = usePathname() ?? "";
	const resolvedPath = resolveMeAccountNavPath(pathname);
	const cacheRef = useRef<{ path: string; node: ReactNode }>({
		path: resolvedPath,
		node: children,
	});
	const [layers, setLayers] = useState<SlideLayer[]>([
		{ key: resolvedPath, content: children, phase: "enter" },
	]);
	const [direction, setDirection] = useState<"forward" | "back">("forward");
	const [isActive, setIsActive] = useState(false);

	useLayoutEffect(() => {
		if (resolvedPath === cacheRef.current.path) {
			cacheRef.current.node = children;
			return;
		}

		const outgoing = cacheRef.current;
		const prevIdx = meAccountNavIndex(outgoing.path);
		const nextIdx = meAccountNavIndex(resolvedPath);
		setDirection(nextIdx >= prevIdx ? "forward" : "back");

		setLayers([
			{ key: outgoing.path, content: outgoing.node, phase: "exit" },
			{ key: resolvedPath, content: children, phase: "enter" },
		]);
		setIsActive(false);

		cacheRef.current = { path: resolvedPath, node: children };

		const frame = window.requestAnimationFrame(() => {
			setIsActive(true);
		});

		const root = document.documentElement;
		const slideMs = Number.parseInt(
			getComputedStyle(root).getPropertyValue("--page-slide-dur") || "200",
			10,
		);
		const fadeMs = Number.parseInt(
			getComputedStyle(root).getPropertyValue("--page-fade-dur") || "200",
			10,
		);
		const timeoutMs = Math.max(slideMs, fadeMs);

		const timeoutId = window.setTimeout(() => {
			setLayers([{ key: resolvedPath, content: children, phase: "enter" }]);
			setIsActive(false);
		}, timeoutMs);

		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(timeoutId);
		};
	}, [resolvedPath, children]);

	const isAnimating = layers.length > 1;

	return (
		<div
			className={cn(
				"t-page-slide relative min-h-[12rem] w-full min-w-0",
				isAnimating && "is-animating",
				isAnimating && isActive && "is-active",
			)}
			data-direction={direction}
		>
			{layers.map((layer) => (
				<section
					key={`${layer.key}-${layer.phase}`}
					className={cn(
						"t-page",
						layer.phase === "enter" ? "is-enter" : "is-exit",
					)}
					data-page-id={layer.key}
					aria-hidden={layer.phase === "exit"}
				>
					{layer.content}
				</section>
			))}
		</div>
	);
}
