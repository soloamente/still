# Neon compute baseline — measurement gate

**Date:** 2026-07-30  
**Status:** Active measurement template  
**Goal:** Hold projected Neon spend under **$25/month** while keeping production responsive at **0.25 CU** minimum.

## Before changes (fill from Neon dashboard)

| Metric | Production branch | Development branch | Notes |
|--------|-------------------|--------------------|-------|
| CU-hours (billing period) | | | Neon **Compute** chart |
| Active hours | | | Wall-clock endpoint uptime |
| Average CU | | | `compute_time_seconds / active_time_seconds` |
| Data transfer (GB) | | | Secondary cost driver |
| Storage (GB) | | | Usually negligible |
| Top Query Insights (1–5) | | | Paste query labels only |

**Capture date:** ___________

## After rollout (compare 7 days at similar traffic)

| Metric | Production branch | Development branch | Delta |
|--------|-------------------|--------------------|-------|
| CU-hours | | | |
| Active hours | | | |
| Average CU | | | |
| Data transfer (GB) | | | |

**Review date:** ___________

## Success criteria

- Production stays near **0.25 CU** minimum with conservative autoscaling.
- Development branch no longer appears continuously active during ordinary `bun dev`.
- No recurring endpoint performs PostgreSQL reads more often than every **5 minutes** unless triggered by patron interaction.
- Projected monthly Neon total **< $25**.

## If the gate fails

Design one disposable **D1 read-model benchmark** for a single read-heavy subsystem only. Do **not** migrate auth, diary, or patron transactional data.

## Neon console paths

1. Project → **Usage** → branch filter → **Compute** (CU-hours).
2. **Monitoring** → **Query insights** → top queries by time.
3. API alternative: `GET /consumption_history/v2/projects/{project_id}` — see [Neon usage calculations](https://neon.com/docs/introduction/usage-calculations).
