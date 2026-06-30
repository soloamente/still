/** Query-backed person detail tabs (`?view=`). */
export type PersonDetailView = "about" | "filmography";

const PERSON_DETAIL_VIEWS: readonly PersonDetailView[] = [
	"about",
	"filmography",
];

function isPersonDetailView(value: string): value is PersonDetailView {
	return (PERSON_DETAIL_VIEWS as readonly string[]).includes(value);
}

export function parsePersonDetailView(
	raw: string | null | undefined,
): PersonDetailView {
	if (raw && isPersonDetailView(raw)) return raw;
	return "about";
}

export function parsePersonDetailViewFromSearchParams(searchParams: {
	view?: string | null;
}): PersonDetailView {
	return parsePersonDetailView(searchParams.view);
}

/** Same-pathname tab href — used with `useLobbyTransition().navigate`. */
export function buildPersonDetailViewHref(
	basePath: string,
	view: PersonDetailView,
): string {
	if (view === "about") return basePath;
	return `${basePath}?view=filmography`;
}
