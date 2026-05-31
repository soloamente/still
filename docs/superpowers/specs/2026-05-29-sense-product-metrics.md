# Sense — Product metrics (Phase 0 instrumentation)

**Status:** Shipped (2026-05-29)  
**Parent:** [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md) §Metrics

## Event pipeline

| Kind | Source | When |
|------|--------|------|
| `import.letterboxd.completed` | Server | Letterboxd import finishes with `imported > 0` |
| `log.first_created` | Server | Patron's first diary log insert |
| `onboarding.completed` | Server | `PATCH /api/profiles/me` sets `markOnboarded` when `onboardedAt` was null |
| `taste_card.shared` | Client | Own profile **Share taste card** copies OG URL |

Storage: `product_event` table (migration **0014**). Client POST: `POST /api/product-events` (auth, rate-limited).

Implementation: `apps/server/src/lib/record-product-event.ts`, `apps/web/src/lib/sense-product-analytics.ts`.

## Roadmap metrics — SQL sketches

Run after `bun run db:migrate` from repo root.

### % import completed in session

```sql
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE kind = 'import.letterboxd.completed') AS imported_patrons,
  COUNT(DISTINCT user_id) AS all_patrons_with_events
FROM product_event
WHERE created_at > NOW() - INTERVAL '7 days';
```

### % log within 48h of signup

```sql
SELECT
  COUNT(*) FILTER (
    WHERE first_log_at <= u.created_at + INTERVAL '48 hours'
  )::float / NULLIF(COUNT(*), 0) AS pct_log_within_48h
FROM "user" u
LEFT JOIN LATERAL (
  SELECT MIN(l.created_at) AS first_log_at
  FROM log l
  WHERE l.user_id = u.id
) fl ON true
WHERE u.created_at > NOW() - INTERVAL '30 days';
```

(Prefer `product_event.kind = 'log.first_created'` once table is populated.)

### D7 retainers with taste signature + ≥10 titles

```sql
SELECT COUNT(DISTINCT u.id)
FROM "user" u
JOIN profile p ON p.user_id = u.id
WHERE u.created_at < NOW() - INTERVAL '7 days'
  AND u.created_at > NOW() - INTERVAL '14 days'
  AND p.taste_signature_json IS NOT NULL
  AND (
    SELECT COUNT(*) FROM log l WHERE l.user_id = u.id
  ) >= 10
  AND EXISTS (
    SELECT 1 FROM log l2
    WHERE l2.user_id = u.id
      AND l2.created_at > u.created_at + INTERVAL '7 days'
  );
```

### Streak distribution (when live)

```sql
SELECT
  current_streak,
  COUNT(*) AS patrons
FROM user_streak
GROUP BY 1
ORDER BY 1;
```

## Next steps (not in v1)

- Admin read API or Metabase connection
- PostHog/Plausible optional bridge via env flag
- Badge unlock → 30-day retention cohort job (scheduled)
