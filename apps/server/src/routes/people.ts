import { env } from "@still/env/server";
import Elysia, { t } from "elysia";

import { context } from "../context";
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
		"/:id",
		async ({ params, status, user }) => {
			const id = Number(params.id);
			if (!Number.isFinite(id)) return status(400, { error: "Invalid id" });

			if (!env.TMDB_API_KEY) {
				return {
					...TMDB_UNCONFIGURED,
					person: null,
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

				return {
					person: {
						id: p.id,
						name: p.name,
						biography: p.biography,
						birthday: p.birthday,
						deathday: p.deathday,
						knownForDepartment: p.known_for_department,
						profilePath: p.profile_path,
						profileUrl: tmdbImg.profile(p.profile_path, "h632"),
					},
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
