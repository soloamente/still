"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";

type ProfileAboutCollapsibleProps = {
	handle: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
};

function formatWebsiteLabel(website: string) {
	return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Collapsible panel shown below profile actions — bio, pronouns, location,
 * website, and the activity heatmap. Hidden entirely when all fields are empty.
 */
export function ProfileAboutCollapsible({
	handle,
	bio,
	pronouns,
	location,
	website,
}: ProfileAboutCollapsibleProps) {
	const [open, setOpen] = useState(false);

	const hasContent =
		bio?.trim() || pronouns?.trim() || location?.trim() || website?.trim();

	const previewParts: string[] = [];
	if (location?.trim()) previewParts.push(location.trim());
	if (website?.trim()) previewParts.push(formatWebsiteLabel(website.trim()));
	if (bio?.trim()) previewParts.push("bio");
	const preview = previewParts.slice(0, 2).join(" · ");

	return (
		<div className="mt-3 w-full overflow-hidden rounded-xl bg-muted/20">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={cn(
					"flex w-full items-center justify-between px-4 py-2.5 text-left",
					"text-muted-foreground text-xs transition-colors",
					"[@media(hover:hover)]:hover:text-foreground",
				)}
				aria-expanded={open}
			>
				<span className="truncate">
					{open ? null : preview || "Activity & more"}
				</span>
				<span className="ml-2 shrink-0">{open ? "less ‹" : "more ›"}</span>
			</button>

			{open ? (
				<div className="flex flex-col gap-3 px-4 pb-4">
					{bio?.trim() ? (
						<p className="text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
							{bio.trim()}
						</p>
					) : null}

					{pronouns?.trim() || location?.trim() || website?.trim() ? (
						<p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs">
							{pronouns?.trim() ? <span>{pronouns.trim()}</span> : null}
							{pronouns?.trim() && (location?.trim() || website?.trim()) ? (
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
							) : null}
							{location?.trim() ? <span>{location.trim()}</span> : null}
							{location?.trim() && website?.trim() ? (
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
							) : null}
							{website?.trim() ? (
								<a
									href={website.trim()}
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
								>
									{formatWebsiteLabel(website.trim())}
								</a>
							) : null}
						</p>
					) : null}

					<ProfileActivitySignature handle={handle} />
				</div>
			) : null}
		</div>
	);
}
