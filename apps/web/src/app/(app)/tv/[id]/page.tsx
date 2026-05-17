import Link from "next/link";

/**
 * Placeholder route for catalogue tiles that link to `/tv/[id]`.
 * Full show pages (cast, seasons, Still-specific data) can replace this later without breaking lobby URLs.
 */
export default async function TvDetailPlaceholderPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return (
		<div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
			<h1 className="font-semibold text-foreground text-xl">TV · TMDb #{id}</h1>
			<p className="text-muted-foreground text-sm leading-relaxed">
				TV detail pages are not fully integrated with Still yet — logging,
				lists, and social features currently centre on films.
			</p>
			<Link
				href="/home"
				className="text-foreground text-sm underline decoration-dashed underline-offset-4 hover:decoration-solid"
			>
				Back to home
			</Link>
		</div>
	);
}
