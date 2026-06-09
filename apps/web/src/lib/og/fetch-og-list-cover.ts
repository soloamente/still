import {
	fetchListDetailById,
	listDetailToFilmRows,
} from "@/lib/fetch-list-detail";
import { listHeroPosterUrls } from "@/lib/list-detail-hero-posters";

/** Public list cover art for OG (custom upload, pinned title, or first poster). */
export async function fetchOgListCoverUrl(
	listId: string,
): Promise<string | null> {
	const data = await fetchListDetailById(listId);
	if (!data?.isPublic) return null;

	const rows = listDetailToFilmRows(data);
	const { posterUrl, backdropUrl } = listHeroPosterUrls(
		data.id,
		rows,
		data.coverMovieId,
		data.coverTvId ?? null,
		data.coverImageUrl,
		data.updatedAt,
	);

	return backdropUrl ?? posterUrl;
}
