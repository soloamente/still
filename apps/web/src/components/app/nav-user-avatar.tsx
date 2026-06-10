import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";

/** Compact avatar — same proxy + `unoptimized` path as `ProfilePatronHeader`. */
export function NavUserAvatar({
	src,
	name,
	handle,
	size = "default",
	isAnimated = false,
	diaryMetalTier = null,
}: {
	src: string | null;
	name: string;
	handle: string;
	/** `compact` = single `size-8` for dense header icon rows (e.g. home sticky). */
	size?: "default" | "compact";
	isAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
}) {
	const frame =
		size === "compact"
			? "size-8 rounded-full text-[10px]"
			: "size-8 rounded-full text-[10px] sm:size-9";
	const px = size === "compact" ? 32 : 36;

	return (
		<PatronPortraitWithMetalTier
			handle={handle}
			avatarUrl={src}
			name={name}
			width={px}
			height={px}
			className={frame}
			isAnimated={isAnimated}
			diaryMetalTier={diaryMetalTier}
		/>
	);
}
