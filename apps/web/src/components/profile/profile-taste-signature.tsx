import { cn } from "@still/ui/lib/utils";

import type { TasteSignatureJson } from "@/lib/sense-taste-signature";

/**
 * Identity core on patron profiles — more prominent than volume stats (Sense Tier 0).
 */
export function ProfileTasteSignature({
	tasteSignature,
	className,
}: {
	tasteSignature: TasteSignatureJson | null;
	className?: string;
}) {
	if (!tasteSignature?.headline) return null;

	return (
		<p
			className={cn(
				"mx-auto mt-4 max-w-md text-balance font-editorial text-foreground/90 text-sm leading-relaxed sm:text-base",
				tasteSignature.confidence === "low" && "text-muted-foreground",
				className,
			)}
		>
			{tasteSignature.headline}
		</p>
	);
}
