import { cn } from "@still/ui/lib/utils";

import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";

type ProfileAboutCollapsibleProps = {
	handle: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	className?: string;
};

function formatWebsiteLabel(website: string) {
	return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Patron about block — bio, meta, and diary heatmap below the identity row.
 * Open editorial layout without avatar chrome or accordion.
 */
export function ProfileAboutCollapsible({
	handle,
	bio,
	pronouns,
	location,
	website,
	className,
}: ProfileAboutCollapsibleProps) {
	const trimmedBio = bio?.trim() ?? "";
	const trimmedPronouns = pronouns?.trim() ?? "";
	const trimmedLocation = location?.trim() ?? "";
	const trimmedWebsite = website?.trim() ?? "";

	const hasMeta =
		Boolean(trimmedPronouns) ||
		Boolean(trimmedLocation) ||
		Boolean(trimmedWebsite);

	const hasCopy = Boolean(trimmedBio) || hasMeta;

	return (
		<section
			className={cn("mt-4 w-full text-left", className)}
			aria-label="About"
		>
			{hasCopy ? (
				<div className="space-y-2.5 text-center">
					{trimmedBio ? (
						<blockquote className="mx-auto max-w-prose text-balance">
							<p className="font-editorial text-foreground/90 text-sm leading-relaxed">
								{trimmedBio}
							</p>
						</blockquote>
					) : null}

					{hasMeta ? (
						<p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs leading-snug">
							{trimmedPronouns ? <span>{trimmedPronouns}</span> : null}
							{trimmedPronouns && (trimmedLocation || trimmedWebsite) ? (
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
							) : null}
							{trimmedLocation ? <span>{trimmedLocation}</span> : null}
							{trimmedLocation && trimmedWebsite ? (
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
							) : null}
							{trimmedWebsite ? (
								<a
									href={trimmedWebsite}
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
								>
									{formatWebsiteLabel(trimmedWebsite)}
								</a>
							) : null}
						</p>
					) : null}
				</div>
			) : null}

			<div
				className={cn("rounded-xl bg-background p-3", hasCopy ? "mt-4" : null)}
			>
				<p className="mb-2 text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
					Diary rhythm
				</p>
				<ProfileActivitySignature handle={handle} />
			</div>
		</section>
	);
}
