# Sense — Tier 3 (Months 6–12) Design

**Status:** Draft — Planner breakdown (2026-05-29); SN.17 spec **Approved** 2026-05-29  
**Parent:** [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md)  
**Strategy source:** [sense-media-platform-strategy.md](../../../sense-media-platform-strategy.md) §9 Tier 3, §12 monetization

## Summary

Tier 0–2 implementation arcs are **code-complete** on the roadmap (launch identity, Tier 1 gamification/social, Tier 2 discovery + profile depth + feed friction). **Tier 3** adds **expression**, **creator depth**, **collaboration**, and optional **anime episodic** tracking — aligned with Pro monetization (themes, analytics, streak extras) without paywalling core diary/social.

## Prerequisites

- Run migration **0014** (`product_event`) for Phase 0 retention instrumentation — see [2026-05-29-sense-product-metrics.md](./2026-05-29-sense-product-metrics.md).
- Tier 2 human QA gates still open: **ST.5.2** (divergence seeding), **HB.4.1**, **RL.7**, **TR.8** — not blockers for Tier 3 planning.

## Recommended build order

| Wave | ID | Feature | Notes |
|------|-----|---------|-------|
| **A** | SN.13 | **Creator analytics v1** | List views/followers proxy from existing tables; owner-only `/me` dashboard — Section 7 Weakness 6 |
| **B** | SN.14 | **Profile themes (Pro-gated)** | `preferences.appearance` already partially wired; expand tokens + preview |
| **C** | SN.15 | **Collaborative lists** | Invite co-curators; shared edit; moderation hooks |
| **D** | SN.16 | **Advanced taste matching** | Friend discovery rail; mutual overlap ranking beyond search |
| **E** | SN.17 | **Seasonal anime / MAL depth** | Spec: [2026-05-29-sense-tier-3-anilist-design.md](./2026-05-29-sense-tier-3-anilist-design.md) — A import → B seasonal → C MAL |
| **Defer** | ST.6 | Director / creator deep-dives | Tier 2 defer carries — after taste discovery v2 |

## SN.13 — Creator analytics v1

### Scope

- Patrons with **curator designation** (SN.11) see a **Lists** analytics strip: public list count, aggregate likes, recent list updates.
- No third-party analytics SDK required — SQL over `list`, `reaction`, `follow`.

### Success criteria

- Curator sees analytics on `/me` or Achievements-adjacent surface.
- Non-curators do not see empty analytics chrome.

## SN.14 — Profile themes (Pro)

### Scope

- Light/dark already in Settings; add **accent presets** + optional **banner frame** for `isPro`.
- Reuse `sanitizeAppearancePreferences` guards.

### Success criteria

- Pro patron preview + save theme; visitor profile reflects public-safe subset.

## SN.15 — Collaborative lists

### Scope

- `list_collaborator` join table; invite by handle; edit rights for items + description.
- Public `/l/[id]` shows co-curator byline.

### Success criteria

- Owner invites collaborator; both can reorder (ranked) and annotate items.

## SN.16 — Advanced taste matching

### Scope

- `GET /api/taste/suggested-patrons` — overlap score + shared genre depth; exclude already-followed.
- Home or People search empty-state wedge.

### Success criteria

- Signed-in patron sees ≥1 suggested patron when graph is sparse and taste signature exists.

## Monetization guardrails (Section 12)

- **Pro:** themes, analytics, extra streak shields, unlimited list length (if cap introduced).
- **Never paywall:** log, review, follow, comment, import.

## Out of scope (Tier 3)

- Forums / open discussion boards
- Streaming affiliate primary UX
- Creator revenue share (Tier 2 monetization — post-scale)
