import { cn } from "@still/ui/lib/utils";
import { ContentPrivateState } from "@/components/content/content-private-state";
import { ProfileTopBar } from "@/components/profile/profile-top-bar";
import {
	type ContentPrivateKind,
	contentPrivateCopy,
} from "@/lib/content-private";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * Profile / list private gate inside the usual sticky top bar + `bg-card` lobby shell.
 */
export function ContentPrivatePageShell({
	kind,
	sharePath,
}: {
	kind: ContentPrivateKind;
	/** Path shown in the top bar share affordance (e.g. `/profile/handle`). */
	sharePath: string;
}) {
	const copy = contentPrivateCopy(kind);

	return (
		<>
			<ProfileTopBar displayName={copy.title} sharePath={sharePath} />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"flex min-h-[min(70svh,36rem)] flex-col",
				)}
			>
				<ContentPrivateState kind={kind} />
			</section>
		</>
	);
}
