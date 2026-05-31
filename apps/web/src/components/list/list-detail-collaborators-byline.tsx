import Link from "next/link";

export type ListCollaboratorSummary = {
	userId: string;
	handle: string;
	displayName: string;
};

/** Public list hero — owner plus invited co-curators (SN.15). */
export function ListDetailCollaboratorsByline({
	owner,
	collaborators,
}: {
	owner: { handle: string; displayName: string } | null;
	collaborators: ListCollaboratorSummary[];
}) {
	if (!owner && collaborators.length === 0) return null;

	const ownerLabel = owner ? (
		<Link
			href={`/profile/${owner.handle}`}
			className="font-medium text-foreground transition-colors duration-200 ease-out [@media(hover:hover)]:hover:text-foreground/85"
		>
			@{owner.handle}
		</Link>
	) : null;

	if (collaborators.length === 0) {
		return ownerLabel ? (
			<p className="mt-3 text-muted-foreground text-sm">
				Curated by {ownerLabel}
			</p>
		) : null;
	}

	return (
		<p className="mt-3 text-balance text-muted-foreground text-sm">
			Curated by {ownerLabel}
			{collaborators.length > 0 ? (
				<>
					{" "}
					with{" "}
					{collaborators.map((c, index) => (
						<span key={c.userId}>
							{index > 0
								? index === collaborators.length - 1
									? " and "
									: ", "
								: null}
							<Link
								href={`/profile/${c.handle}`}
								className="font-medium text-foreground transition-colors duration-200 ease-out [@media(hover:hover)]:hover:text-foreground/85"
							>
								@{c.handle}
							</Link>
						</span>
					))}
				</>
			) : null}
		</p>
	);
}
