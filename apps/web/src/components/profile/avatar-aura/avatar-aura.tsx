import { cn } from "@still/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

import {
	AVATAR_AURA_WELL_INSET_PERCENT,
	avatarAuraFrameMaskStyle,
} from "@/components/profile/avatar-aura/avatar-aura-frame-path";
import {
	avatarAuraFrameKind,
	avatarAuraVisualClassName,
	hasAvatarAuraVisual,
	resolveAvatarAuraVisual,
} from "@/components/profile/avatar-aura/avatar-aura-tier";

/**
 * Plan / staff scallop frame — metal layer masked to an SVG silhouette.
 * Photo stays a circle. Decorative; no hover WebGL.
 */
export function AvatarAura({
	planTier,
	staffRole,
	children,
	className,
	style,
}: {
	planTier?: unknown;
	staffRole?: unknown;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}) {
	const visual = resolveAvatarAuraVisual({ planTier, staffRole });
	if (!hasAvatarAuraVisual(visual)) {
		return <>{children}</>;
	}

	const frameKind = avatarAuraFrameKind(visual);
	if (!frameKind) {
		return <>{children}</>;
	}

	const rimClass = avatarAuraVisualClassName(visual);
	const maskStyle = avatarAuraFrameMaskStyle(frameKind);

	return (
		<span
			className={cn(
				"avatar-aura-root avatar-aura-rim relative inline-flex min-w-0 overflow-visible",
				rimClass,
				className,
			)}
			style={{ ...maskStyle, ...style } as CSSProperties}
		>
			<span className="avatar-aura-metal" aria-hidden />
			<span
				className="avatar-aura-well relative z-10 overflow-hidden rounded-full"
				style={{ margin: `${AVATAR_AURA_WELL_INSET_PERCENT}%` }}
			>
				{children}
			</span>
			<span className="avatar-aura-sheen" aria-hidden />
		</span>
	);
}
