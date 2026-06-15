-- Seed Sense Journal launch articles (idempotent).
-- Requires at least one staff user (`owner` or `admin`). Run after `0029_journal_post` migration:
--   bun run db:seed-journal

INSERT INTO journal_post (
	id,
	slug,
	title,
	dek,
	body,
	hero_image_url,
	author_user_id,
	status,
	published_at,
	tags,
	created_at,
	updated_at
)
SELECT
	'journal_seed_why_taste',
	'why-taste-maps-matter',
	'Why taste maps matter',
	'Sense is built around the idea that what you watch is who you are — not a single score, but a pattern.',
	$$Taste is not a number on a poster. It is the **shape** of what you return to: comfort rewatches, risky premieres, the show you defend at dinner.

On Sense, every diary log is a coordinate. Over time those coordinates become a map — not for ranking you against the world, but for helping you **find your people** and **trust your own lens**.

We built the Journal because culture needs slower rooms. The feed is fast; the diary is honest; the essay is where we connect the two.$$,
	NULL,
	u.id,
	'published',
	now() - interval '21 days',
	'["editorial","taste"]'::jsonb,
	now() - interval '21 days',
	now() - interval '21 days'
FROM "user" u
WHERE u.role IN ('owner', 'admin')
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO journal_post (
	id, slug, title, dek, body, hero_image_url, author_user_id, status, published_at, tags, created_at, updated_at
)
SELECT
	'journal_seed_diary_ritual',
	'the-diary-is-the-ritual',
	'The diary is the ritual',
	'Logging a film is not homework. It is the smallest act of paying attention.',
	$$Letterboxd taught a generation to **log first, talk second**. We agree — with one twist: venue matters, rewatch matters, and voice can matter too.

Your diary is the record you actually trust when a recommendation lands wrong. It is also the fuel for streaks, taste overlap, and the quiet pride of a filled year.

Start small: one honest score, one line about where you watched it, one tag for who you would recommend it to. The map fills in later.$$,
	NULL,
	u.id,
	'published',
	now() - interval '14 days',
	'["diary","ritual"]'::jsonb,
	now() - interval '14 days',
	now() - interval '14 days'
FROM "user" u
WHERE u.role IN ('owner', 'admin')
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO journal_post (
	id, slug, title, dek, body, hero_image_url, author_user_id, status, published_at, tags, created_at, updated_at
)
SELECT
	'journal_seed_community',
	'community-without-the-feed',
	'Community without the feed',
	'How Sense thinks about reviews, lists, and ranks — without turning taste into a horse race.',
	$$Social taste breaks when everything is optimized for **engagement**. We would rather surface wit, curation, and disagreement you can learn from.

Community on Sense is period-aware: lists, reviews, activity, and leaderboards respect the window you are browsing. Viral reviews reward brevity and warmth, not outrage.

The Journal is our editorial lane — staff-authored for now, public always. Patron stories come through reviews and lists first; the magazine follows the culture you already make.$$,
	NULL,
	u.id,
	'published',
	now() - interval '7 days',
	'["community","product"]'::jsonb,
	now() - interval '7 days',
	now() - interval '7 days'
FROM "user" u
WHERE u.role IN ('owner', 'admin')
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO journal_post (
	id, slug, title, dek, body, hero_image_url, author_user_id, status, published_at, tags, created_at, updated_at
)
SELECT
	'journal_seed_welcome',
	'welcome-to-the-journal',
	'Welcome to the Journal',
	'What this section is — and what we will publish here.',
	$$This is the Sense **Journal**: essays on film, TV, and the social life of taste.

You will find product philosophy, culture notes, and occasional deep dives tied to what ships in the app. Everything here is indexable, shareable, and readable without an account.

We are starting with four pieces to set the tone. More arrive as the team publishes. If a headline resonates, bring it back to your diary — that is where your version of the story lives.$$,
	NULL,
	u.id,
	'published',
	now() - interval '1 day',
	'["announcement"]'::jsonb,
	now() - interval '1 day',
	now() - interval '1 day'
FROM "user" u
WHERE u.role IN ('owner', 'admin')
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (slug) DO NOTHING;
