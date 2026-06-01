import IconLockFill from "@still/ui/icons/lock-fill";
import type { ContentVisibility } from "@/components/review/visibility-select";

const LABELS: Record<Exclude<ContentVisibility, "public">, string> = {
	followers: "Followers",
	friends: "Friends",
	private: "Only you",
};

/** Small muted chip shown to the AUTHOR on their own non-public review/log. */
export function VisibilityChip({
	visibility,
}: {
	visibility: ContentVisibility;
}) {
	if (visibility === "public") return null;
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-muted-foreground text-xs">
			{visibility === "private" ? (
				<IconLockFill size="10px" className="shrink-0" aria-hidden />
			) : null}
			{LABELS[visibility]}
		</span>
	);
}
