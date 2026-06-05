import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";

/** Compact avatar — same proxy + `unoptimized` path as `ProfilePatronHeader`. */
export function NavUserAvatar({
	src,
	name,
	handle,
	size = "default",
}: {
	src: string | null;
	name: string;
	handle: string;
	/** `compact` = single `size-8` for dense header icon rows (e.g. home sticky). */
	size?: "default" | "compact";
}) {
	const frame =
		size === "compact"
			? "size-8 rounded-full text-[10px]"
			: "size-8 rounded-full text-[10px] sm:size-9";

	return (
		<PatronPortraitAvatar
			handle={handle}
			avatarUrl={src}
			name={name}
			width={72}
			height={72}
			className={frame}
		/>
	);
}
