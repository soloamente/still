import {
	fetchListDetailById,
	listDetailToFilmRows,
} from "@/lib/fetch-list-detail";
import { listHeroPosterUrls } from "@/lib/list-detail-hero-posters";

/** Public list cover art for OG (custom upload, pinned title, or first poster). */
export async function fetchOgListCoverUrl(
	listId: string,
): Promise<string | null> {
	const result = await fetchListDetailById(listId);
	if (result.status !== "ok" || !result.data.isPublic) return null;
	const data = result.data;

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
