import { cn } from "@still/ui/lib/utils";
import { Fragment, type ReactNode } from "react";

type ProfilePatronBylineProps = {
	pronouns: string | null;
	/** Filmography count for the active ledger tab, e.g. "28 films logged". */
	titleCountLine?: string | null;
	stats: { followers: number; following: number };
	location: string | null;
	website: string | null;
	className?: string;
};

function formatWebsiteLabel(website: string) {
	return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Single wrapped meta row under the profile identity block — avoids a vertical "log" of lines.
 */
export function ProfilePatronByline({
	pronouns,
	titleCountLine,
	stats,
	location,
	website,
	className,
}: ProfilePatronBylineProps) {
	type Segment = { key: string; node: ReactNode };

	const segments: Segment[] = [];

	if (pronouns?.trim()) {
		segments.push({ key: "pronouns", node: pronouns.trim() });
	}
	if (titleCountLine?.trim()) {
		segments.push({
			key: "count",
			node: <span className="tabular-nums">{titleCountLine.trim()}</span>,
		});
	}
	segments.push({
		key: "social",
		node: (
			<span className="tabular-nums">
				<span className="font-medium text-foreground">{stats.followers}</span>{" "}
				followers
				<span aria-hidden className="mx-1.5 text-muted-foreground/45">
					·
				</span>
				<span className="font-medium text-foreground">{stats.following}</span>{" "}
				following
			</span>
		),
	});
	if (location?.trim()) {
		segments.push({ key: "location", node: location.trim() });
	}
	if (website?.trim()) {
		const href = website.trim();
		segments.push({
			key: "website",
			node: (
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
				>
					{formatWebsiteLabel(href)}
				</a>
			),
		});
	}

	return (
		<p
			className={cn(
				"flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-muted-foreground text-sm leading-snug",
				className,
			)}
		>
			{segments.map((segment, index) => (
				<Fragment key={segment.key}>
					{index > 0 ? (
						<span aria-hidden className="select-none text-muted-foreground/40">
							·
						</span>
					) : null}
					<span>{segment.node}</span>
				</Fragment>
			))}
		</p>
	);
}
