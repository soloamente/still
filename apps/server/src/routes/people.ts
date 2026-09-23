import { env } from "@still/env/server";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import {
	mergeTrafficLedPeople,
	rankPeopleBySearchTraffic,
	rankPeopleFavoritesFirst,
} from "../lib/people-search-rank";
import {
	mapTmdbPersonToSearchRow,
	withPersonFavoriteFlags,
} from "../lib/people-search-row";
import {
	addPersonFavorite,
	getPersonFavoriteState,
	listFavoritedPersonIdsAmong,
	removePersonFavorite,
	setPersonFavoriteAlerts,
} from "../lib/person-favorite";
import { buildPersonGallerySlides } from "../lib/person-gallery-slides";
import {
	getPersonSearchTrafficCounts,
	incrementPersonSearchTraffic,
	listTopPersonSearchTraffic,
} from "../lib/person-search-traffic";
import { recordProductEvent } from "../lib/record-product-event";
import { tmdbApi, tmdbImg } from "../lib/tmdb";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";

/** Same contract as movie search when `TMDB_API_KEY` is missing — the web UI can show setup hints. */
const TMDB_UNCONFIGURED = {
	code: "TMDB_UNCONFIGURED" as const,
	hint: "Add TMDB_API_KEY to apps/server .env (API key from https://www.themoviedb.org/settings/api). Restart the API server after saving.",
};

/**
 * Person detail + merged filmography. Proxies TMDb `person` with
 * `append_to_response=movie_credits` so the app can show every title the
 * person acted in or worked on as crew, without storing a full persons DB.
 */
export const peopleRoute = new Elysia({
	prefix: "/api/people",
	tags: ["people"],
})
	.use(context)
	.get(
		"/search",
		async ({ query, user }) => {
			const q = (query.q ?? "").trim();
			if (!q) return { results: [], page: 1, total_pages: 0, total_results: 0 };
			if (!env.TMDB_API_KEY) {
				return {
					...TMDB_UNCONFIGURED,
					results: [],
					page: 1,
					total_pages: 0,
					total_results: 0,
				};
			}
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const page = Number(query.page ?? 1) || 1;
			const data = await tmdbApi.searchPerson(q, page, {
				language,
				showAdultContent,
			});
			// Rank by Sense search traffic first; TMDb popularity only breaks ties.
			const traffic = await getPersonSearchTrafficCounts(
				data.results.map((person) => person.id),
			);
			const favoritedIds = user?.id
				? await listFavoritedPersonIdsAmong(
						user.id,
						data.results.map((person) => person.id),
					)
				: new Set<number>();
			// Favorites float above traffic; within each band traffic still decides.
			const ranked = rankPeopleFavoritesFirst(
				data.results,
				favoritedIds,
				(slice) => rankPeopleBySearchTraffic(slice, traffic),
			);
			return {
				results: withPersonFavoriteFlags(
					ranked.map(mapTmdbPersonToSearchRow),
					favoritedIds,
				),
				page: data.page,
				total_pages: data.total_pages,
				total_results: data.total_results,
			};
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				page: t.Optional(t.String()),
			}),
		},
	)
	// Static `/popular` must register before `/:id` or Elysia treats "popular" as an id.
	.get(
		"/popular",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) {
				const trafficLeaders = await listTopPersonSearchTraffic(12);
				const favoritedIds = user?.id
					? await listFavoritedPersonIdsAmong(
							user.id,
							trafficLeaders.map((row) => row.id),
						)
					: new Set<number>();
				const ranked = rankPeopleFavoritesFirst(
					trafficLeaders,
					favoritedIds,
					(slice) => slice,
				);
				return {
					...TMDB_UNCONFIGURED,
					results: withPersonFavoriteFlags(ranked, favoritedIds),
					page,
					total_pages: trafficLeaders.length > 0 ? 1 : 0,
					total_results: trafficLeaders.length,
				};
			}
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const [trafficLeaders, data] = await Promise.all([
				listTopPersonSearchTraffic(12),
				tmdbApi.personPopular(page, {
					language,
					showAdultContent,
				}),
			]);
			const tmdbRows = data.results.map(mapTmdbPersonToSearchRow);
			const merged = mergeTrafficLedPeople(trafficLeaders, tmdbRows, 20);
			const favoritedIds = user?.id
				? await listFavoritedPersonIdsAmong(
						user.id,
						merged.map((row) => row.id),
					)
				: new Set<number>();
			const ranked = rankPeopleFavoritesFirst(
				merged,
				favoritedIds,
				(slice) => slice,
			);
			return {
				results: withPersonFavoriteFlags(ranked, favoritedIds),
				page: data.page,
				total_pages: data.total_pages,
				total_results: data.total_results,
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/search-hit",
		async ({ body }) => {
			const id = Number(body.id);
			if (!Number.isFinite(id) || id < 1) return { ok: false };
			await incrementPersonSearchTraffic({
				tmdbId: id,
				name: body.name ?? "",
				profileUrl: body.profileUrl ?? null,
			});
			return { ok: true };
		},
		{
			body: t.Object({
				id: t.Number(),
				name: t.Optional(t.String()),
				profileUrl: t.Optional(t.Union([t.String(), t.Null()])),
			}),
		},
	)
	.get(
		"/:id/favorite",
		async ({ params, status, user }) => {
			if (!user) return status(401, { error: "Sign in" });
			const id = Number(params.id);
			if (!Number.isFinite(id) || id < 1) {
				return status(400, { error: "Invalid id" });
			}
			return getPersonFavoriteState(user.id, id);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/favorite",
		async ({ params, status, user }) => {
			if (!user) return status(401, { error: "Sign in" });
			const id = Number(params.id);
			if (!Number.isFinite(id) || id < 1) {
				return status(400, { error: "Invalid id" });
			}
			if (!env.TMDB_API_KEY) {
				return status(503, { error: "TMDb not configured", ...TMDB_UNCONFIGURED });
			}
			try {
				const result = await addPersonFavorite({
					userId: user.id,
					tmdbPersonId: id,
				});
				if (!result) return status(404, { error: "Person not found" });
				void recordProductEvent(user.id, "person_favorite.add", {
					tmdbPersonId: result.tmdbPersonId,
					name: result.name,
				});
				return {
					favorited: true as const,
					alertsEnabled: result.alertsEnabled,
				};
			} catch (err) {
				console.error("[people] favorite add failed", { id, err });
				return status(500, { error: "Could not favorite person" });
			}
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.patch(
		"/:id/favorite",
		async ({ params, body, status, user }) => {
			if (!user) return status(401, { error: "Sign in" });
			const id = Number(params.id);
			if (!Number.isFinite(id) || id < 1) {
				return status(400, { error: "Invalid id" });
			}
			if (typeof body.alertsEnabled !== "boolean") {
				return status(400, { error: "alertsEnabled required" });
			}
			if (body.alertsEnabled && !env.TMDB_API_KEY) {
				return status(503, { error: "TMDb not configured", ...TMDB_UNCONFIGURED });
			}
			try {
				const state = await setPersonFavoriteAlerts({
					userId: user.id,
					tmdbPersonId: id,
					alertsEnabled: body.alertsEnabled,
				});
				if (!state) return status(404, { error: "Person not found" });
				return state;
			} catch (err) {
				console.error("[people] favorite alerts patch failed", { id, err });
				return status(500, { error: "Could not update alerts" });
			}
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				alertsEnabled: t.Boolean(),
			}),
		},
	)
	.delete(
		"/:id/favorite",
		async ({ params, status, user }) => {
			if (!user) return status(401, { error: "Sign in" });
			const id = Number(params.id);
			if (!Number.isFinite(id) || id < 1) {
				return status(400, { error: "Invalid id" });
			}
			const { removed } = await removePersonFavorite({
				userId: user.id,
				tmdbPersonId: id,
			});
			if (removed) {
				void recordProductEvent(user.id, "person_favorite.remove", {
					tmdbPersonId: id,
				});
			}
			return {
				favorited: false as const,
				alertsEnabled: false as const,
				removed,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id",
		async ({ params, status, user }) => {
			const id = Number(params.id);
			if (!Number.isFinite(id)) return status(400, { error: "Invalid id" });

			if (!env.TMDB_API_KEY) {
				return {
					...TMDB_UNCONFIGURED,
					person: null,
					screenshots: [] as unknown[],
					filmography: [] as unknown[],
				};
			}

			try {
				const language = await getTmdbLanguageForUser(user?.id);
				const p = await tmdbApi.person(id, { language });
				if (!p?.id) return status(404, { error: "Person not found" });

				const movieCast = p.movie_credits?.cast ?? [];
				const movieCrew = p.movie_credits?.crew ?? [];
				const tvCast = p.tv_credits?.cast ?? [];
				const tvCrew = p.tv_credits?.crew ?? [];

				// One row per title; movie and TV ids can collide — key by media kind + id.
				const byTitle = new Map<
					string,
					{
						tmdbId: number;
						mediaKind: "movie" | "tv";
						title: string;
						posterPath: string | null;
						releaseDate: string | null;
						roles: string[];
					}
				>();

				const addPart = (
					mediaKind: "movie" | "tv",
					titleId: number,
					title: string,
					posterPath: string | null,
					releaseDate: string | null | undefined,
					label: string,
				) => {
					const mapKey = `${mediaKind}:${titleId}`;
					let row = byTitle.get(mapKey);
					if (!row) {
						row = {
							tmdbId: titleId,
							mediaKind,
							title,
							posterPath,
							releaseDate: releaseDate
								? String(releaseDate).slice(0, 10)
								: null,
							roles: [],
						};
						byTitle.set(mapKey, row);
					}
					if (!row.roles.includes(label)) row.roles.push(label);
				};

				for (const c of movieCast) {
					if (!c.id) continue;
					const title =
						c.title?.trim() || c.original_title?.trim() || "Untitled";
					const label = c.character?.trim()
						? `as ${c.character.trim()}`
						: "Actor";
					addPart("movie", c.id, title, c.poster_path, c.release_date, label);
				}
				for (const c of movieCrew) {
					if (!c.id) continue;
					const title =
						c.title?.trim() || c.original_title?.trim() || "Untitled";
					const label = c.job?.trim() || "Crew";
					addPart("movie", c.id, title, c.poster_path, c.release_date, label);
				}
				for (const c of tvCast) {
					if (!c.id) continue;
					const title = c.name?.trim() || c.original_name?.trim() || "Untitled";
					const label = c.character?.trim()
						? `as ${c.character.trim()}`
						: "Actor";
					addPart("tv", c.id, title, c.poster_path, c.first_air_date, label);
				}
				for (const c of tvCrew) {
					if (!c.id) continue;
					const title = c.name?.trim() || c.original_name?.trim() || "Untitled";
					const label = c.job?.trim() || "Crew";
					addPart("tv", c.id, title, c.poster_path, c.first_air_date, label);
				}

				const filmography = [...byTitle.values()].sort((a, b) => {
					const da = a.releaseDate ?? "";
					const db = b.releaseDate ?? "";
					if (da !== db) return db.localeCompare(da);
					return a.title.localeCompare(b.title);
				});

				const screenshots = buildPersonGallerySlides({
					personName: p.name,
					heroProfilePath: p.profile_path,
					taggedImages: p.tagged_images?.results ?? [],
					profiles: p.images?.profiles ?? [],
				});

				return {
					person: {
						id: p.id,
						name: p.name,
						biography: p.biography,
						birthday: p.birthday,
						deathday: p.deathday,
						placeOfBirth: p.place_of_birth ?? null,
						gender: p.gender ?? null,
						knownForDepartment: p.known_for_department,
						profilePath: p.profile_path,
						profileUrl: tmdbImg.profile(p.profile_path, "h632"),
						imdbId: p.external_ids?.imdb_id?.trim() || null,
					},
					// About-tab stills rail — tagged film/TV frames + extra headshots.
					screenshots,
					filmography: filmography.map((m) => ({
						tmdbId: m.tmdbId,
						mediaKind: m.mediaKind,
						title: m.title,
						posterUrl: tmdbImg.poster(m.posterPath, "w342"),
						// Force plain ISO prefix so JSON clients never revive a Date for this field.
						releaseDate:
							m.releaseDate != null ? String(m.releaseDate).slice(0, 10) : null,
						roles: m.roles,
					})),
				};
			} catch (err) {
				console.error("[people] TMDb person fetch failed", err);
				return status(404, { error: "Person not found" });
			}
		},
		{ params: t.Object({ id: t.String() }) },
	);
