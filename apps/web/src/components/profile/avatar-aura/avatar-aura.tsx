import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import {
	avatarAuraVisualClassName,
	hasAvatarAuraVisual,
	resolveAvatarAuraVisual,
} from "@/components/profile/avatar-aura/avatar-aura-tier";

/**
 * Static portrait rim — subscription tier or staff seal; no hover motion.
 */
export function AvatarAura({
	planTier,
	staffRole,
	children,
	className,
}: {
	planTier?: unknown;
	staffRole?: unknown;
	children: ReactNode;
	className?: string;
}) {
	const visual = resolveAvatarAuraVisual({ planTier, staffRole });
	if (!hasAvatarAuraVisual(visual)) {
		return <>{children}</>;
	}

	const rimClass = avatarAuraVisualClassName(visual);

	return (
		<span
			className={cn(
				"avatar-aura-root avatar-aura-rim relative inline-flex min-w-0",
				rimClass,
				className,
			)}
		>
			<span className="avatar-aura-well relative size-full overflow-hidden rounded-full">
				{children}
			</span>
		</span>
	);
}
