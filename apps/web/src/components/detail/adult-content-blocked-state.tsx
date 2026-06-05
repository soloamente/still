import { buttonVariants } from "@still/ui/components/button";
import Link from "next/link";

/** Centered gate when patron has adult content disabled on movie/TV detail. */
export function AdultContentBlockedState() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="text-balance font-semibold text-foreground text-xl">
				Adult content is hidden
			</h1>
			<p className="max-w-md text-balance text-muted-foreground text-sm leading-relaxed">
				Turn on adult content in Settings → Catalogue if you are 18 or older.
			</p>
			<Link
				href="/me/settings/catalogue"
				className={buttonVariants({ variant: "default" })}
			>
				Open Settings
			</Link>
		</div>
	);
}
