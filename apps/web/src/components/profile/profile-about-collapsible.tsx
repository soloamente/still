import { cn } from "@still/ui/lib/utils";

import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";

type ProfileAboutCollapsibleProps = {
	handle: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	birthdayDisplay?: string | null;
	className?: string;
	/** Diary rhythm renders in the header streak pill popover — hide inline heatmap. */
	hideActivitySignature?: boolean;
	/** Meta renders in the profile hero under @handle — skip duplicate row here. */
	hideMeta?: boolean;
};

function formatWebsiteLabel(website: string) {
	return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Pronouns · location · website row — sits under @handle in the profile hero. */
export function ProfilePatronMetaLine({
	pronouns,
	location,
	website,
	birthdayDisplay,
	className,
}: {
	pronouns: string | null;
	location: string | null;
	website: string | null;
	birthdayDisplay?: string | null;
	className?: string;
}) {
	const trimmedPronouns = pronouns?.trim() ?? "";
	const trimmedLocation = location?.trim() ?? "";
	const trimmedWebsite = website?.trim() ?? "";
	const trimmedBirthday = birthdayDisplay?.trim() ?? "";

	const hasMeta =
		Boolean(trimmedPronouns) ||
		Boolean(trimmedLocation) ||
		Boolean(trimmedWebsite) ||
		Boolean(trimmedBirthday);

	if (!hasMeta) return null;

	return (
		<p
			className={cn(
				"mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs leading-snug",
				className,
			)}
		>
			{trimmedPronouns ? <span>{trimmedPronouns}</span> : null}
			{trimmedPronouns &&
			(trimmedLocation || trimmedWebsite || trimmedBirthday) ? (
				<span aria-hidden className="text-muted-foreground/40">
					·
				</span>
			) : null}
			{trimmedLocation ? <span>{trimmedLocation}</span> : null}
			{trimmedLocation && (trimmedWebsite || trimmedBirthday) ? (
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
			{trimmedWebsite && trimmedBirthday ? (
				<span aria-hidden className="text-muted-foreground/40">
					·
				</span>
			) : null}
			{trimmedBirthday ? <span>{trimmedBirthday}</span> : null}
		</p>
	);
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
	birthdayDisplay,
	className,
	hideActivitySignature = false,
	hideMeta = false,
}: ProfileAboutCollapsibleProps) {
	const trimmedBio = bio?.trim() ?? "";

	const hasMeta =
		!hideMeta &&
		(Boolean(pronouns?.trim()) ||
			Boolean(location?.trim()) ||
			Boolean(website?.trim()) ||
			Boolean(birthdayDisplay?.trim()));

	const hasCopy = Boolean(trimmedBio) || hasMeta;
	const showActivity = !hideActivitySignature;

	if (!hasCopy && !showActivity) {
		return null;
	}

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
						<ProfilePatronMetaLine
							pronouns={pronouns}
							location={location}
							website={website}
							birthdayDisplay={birthdayDisplay}
						/>
					) : null}
				</div>
			) : null}

			{showActivity ? (
				<div className={cn(hasCopy ? "mt-4" : "mt-0")}>
					<p className="mb-2 text-center text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
						Diary rhythm
					</p>
					<ProfileActivitySignature handle={handle} variant="embedded" />
				</div>
			) : null}
		</section>
	);
}
