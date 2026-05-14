import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Local mirror of TMDb's `/movie/:id` payload. `tmdbId` is the PK so we
 * never have to maintain a separate id-mapping table. The full TMDb
 * response is kept verbatim in `tmdbJson` so feature work doesn't keep
 * having to re-shape it as new fields come online (providers, watch
 * regions, content ratings, etc.).
 */
export const movie = pgTable(
  "movie",
  {
    tmdbId: integer("tmdb_id").primaryKey(),
    imdbId: text("imdb_id"),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    releaseDate: timestamp("release_date", { withTimezone: false }),
    runtime: integer("runtime"), // minutes
    overview: text("overview"),
    tagline: text("tagline"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    // Flattened TMDb genre ids for cheap filtering — full names are also in tmdbJson.
    genreIds: jsonb("genre_ids").$type<number[]>().default([]).notNull(),
    originalLanguage: text("original_language"),
    spokenLanguages: jsonb("spoken_languages").$type<string[]>().default([]).notNull(),
    popularity: doublePrecision("popularity"),
    voteAverage: doublePrecision("vote_average"),
    voteCount: integer("vote_count"),
    adult: boolean("adult").default(false).notNull(),
    status: text("status"), // "Released", "Post Production", etc.
    // Whole TMDb response (with credits, providers, similar, recommendations
    // appended); refreshed nightly by the tmdb-sync job.
    tmdbJson: jsonb("tmdb_json").$type<Record<string, unknown>>(),
    /** Poster-derived palette (node-vibrant); nullable until a detail sync runs. */
    paletteAccent: text("palette_accent"),
    paletteMuted: text("palette_muted"),
    paletteForeground: text("palette_foreground"),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("movie_title_idx").on(table.title),
    index("movie_year_idx").on(table.year),
    index("movie_popularity_idx").on(table.popularity),
    index("movie_release_date_idx").on(table.releaseDate),
  ],
);

/** Cast/crew master record. */
export const person = pgTable(
  "person",
  {
    tmdbId: integer("tmdb_id").primaryKey(),
    name: text("name").notNull(),
    profilePath: text("profile_path"),
    knownForDepartment: text("known_for_department"), // Acting, Directing, ...
    birthday: timestamp("birthday", { withTimezone: false }),
    deathday: timestamp("deathday", { withTimezone: false }),
    biography: text("biography"),
    popularity: doublePrecision("popularity"),
    tmdbJson: jsonb("tmdb_json").$type<Record<string, unknown>>(),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  },
  (table) => [
    index("person_name_idx").on(table.name),
    index("person_popularity_idx").on(table.popularity),
  ],
);

/**
 * Join: (movie, person, role). Composite PK keeps inserts idempotent.
 * `department` and `job` discriminate cast vs crew without a second table.
 */
export const movieCredit = pgTable(
  "movie_credit",
  {
    movieId: integer("movie_id")
      .notNull()
      .references(() => movie.tmdbId, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => person.tmdbId, { onDelete: "cascade" }),
    creditId: text("credit_id").notNull(), // TMDb credit id; disambiguates double-roles
    department: text("department").notNull(), // "Cast" | "Directing" | "Writing" | ...
    job: text("job"), // null for cast
    character: text("character"), // null for crew
    order: integer("order"), // billing order
  },
  (table) => [
    primaryKey({ columns: [table.movieId, table.creditId] }),
    index("movie_credit_person_idx").on(table.personId),
    index("movie_credit_movie_idx").on(table.movieId),
    index("movie_credit_department_idx").on(table.department),
  ],
);

export const movieRelations = relations(movie, ({ many }) => ({
  credits: many(movieCredit),
}));

export const personRelations = relations(person, ({ many }) => ({
  credits: many(movieCredit),
}));

export const movieCreditRelations = relations(movieCredit, ({ one }) => ({
  movie: one(movie, {
    fields: [movieCredit.movieId],
    references: [movie.tmdbId],
  }),
  person: one(person, {
    fields: [movieCredit.personId],
    references: [person.tmdbId],
  }),
}));
