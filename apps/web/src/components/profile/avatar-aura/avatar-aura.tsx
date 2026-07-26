"use client";

import type { PlanTierId } from "@still/plans";
import { cn } from "@still/ui/lib/utils";
import dynamic from "next/dynamic";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	avatarAuraRimStyle,
	hasAvatarAura,
} from "@/components/profile/avatar-aura/avatar-aura-tier";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/** Loaded on first Devoted hover only — keeps GLSL out of the main bundle. */
const AvatarAuraDevotedCanvas = dynamic(
	() =>
		import("@/components/profile/avatar-aura/avatar-aura-devoted-canvas").then(
			(mod) => mod.AvatarAuraDevotedCanvas,
		),
	{ ssr: false },
);

const HOVER_INTENT_MS = 80;
const HOVER_EXIT_GRACE_MS = 300;

export function AvatarAura({
	tier,
	children,
	className,
}: {
	tier: PlanTierId;
	children: ReactNode;
	className?: string;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const [devotedActive, setDevotedActive] = useState(false);
	const [webglFailed, setWebglFailed] = useState(false);
	const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const wantsCanvas =
		tier === "devoted" && !reducedMotion && !softwareGpu && !webglFailed;

	const handleEnter = useCallback(() => {
		if (!wantsCanvas) return;
		if (exitTimer.current) clearTimeout(exitTimer.current);
		// Intent delay kills canvas churn while sweeping the cursor across a feed.
		intentTimer.current = setTimeout(
			() => setDevotedActive(true),
			HOVER_INTENT_MS,
		);
	}, [wantsCanvas]);

	const handleLeave = useCallback(() => {
		if (intentTimer.current) clearTimeout(intentTimer.current);
		// Exit grace lets a quick re-enter reuse the live context.
		exitTimer.current = setTimeout(
			() => setDevotedActive(false),
			HOVER_EXIT_GRACE_MS,
		);
	}, []);

	useEffect(
		() => () => {
			if (intentTimer.current) clearTimeout(intentTimer.current);
			if (exitTimer.current) clearTimeout(exitTimer.current);
		},
		[],
	);

	if (!hasAvatarAura(tier)) {
		return <>{children}</>;
	}

	return (
		<span
			className={cn(
				"avatar-aura-root avatar-aura-rim relative inline-flex size-full",
				className,
			)}
			style={avatarAuraRimStyle(tier)}
			onPointerEnter={handleEnter}
			onPointerLeave={handleLeave}
		>
			<span className="relative size-full overflow-hidden rounded-full">
				{children}
				{tier === "attuned" ? (
					<span aria-hidden className="avatar-aura-layer avatar-aura-sweep" />
				) : null}
				{tier === "immersed" ? (
					<>
						<span aria-hidden className="avatar-aura-layer avatar-aura-glow" />
						<span aria-hidden className="avatar-aura-layer avatar-aura-flare" />
					</>
				) : null}
				{tier === "devoted" && !wantsCanvas && !reducedMotion ? (
					<span aria-hidden className="avatar-aura-layer avatar-aura-holo" />
				) : null}
				{devotedActive ? (
					<AvatarAuraDevotedCanvas onWebglFailed={() => setWebglFailed(true)} />
				) : null}
			</span>
		</span>
	);
}
