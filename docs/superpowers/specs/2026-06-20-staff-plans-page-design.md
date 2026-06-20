# Staff Plans Page — Design Spec

**Date:** 2026-06-20
**Status:** Approved

---

## Overview

A new `/staff/plans` route where staff members can review and collaboratively edit the subscription plan feature definitions. The page shows who is viewing it live (presence avatars with name + role tooltips on hover), two views for working with feature data, and a drawer for creating new features.

This page is the source of truth for what each subscription tier offers. It does not gate features in production directly — it defines the feature catalogue that the pricing page (and enforcement logic) reads from.

---

## Subscription Tiers (decided in brainstorm)

| Tier | Price (annual) | Price (monthly) | Positioning |
|------|---------------|-----------------|-------------|
| **Still** | Free | Free | Quiet foundation — always free |
| **Attuned** | $24/yr | $3/mo | Know yourself as a watcher |
| **Immersed** | $48/yr | $6/mo | Expression, social depth, engagement layer |
| **Devoted** | $100/yr | $12/mo | You helped build this |

Pricing strategy: sweet-spot positioning. Attuned undercuts Letterboxd Pro ($19.99). Immersed matches Letterboxd Patron ($49) with far richer features. Devoted is a genuine premium anchor using anchoring + decoy psychology.

---

## Feature Catalogue (initial seed)

### Still (Free)
| Feature | Status |
|---------|--------|
| Log movies, TV & anime | exists |
| Watchlist & ratings | exists |
| Reviews & lists | exists |
| Follow & social feed | exists |
| Import from Letterboxd, AniList, MAL | exists |
| TV episode progress tracking | exists |
| Basic streaks & starter badges | exists |
| Year in review (annual snapshot) | planned |

### Attuned ($24/yr)
Everything in Still, plus:

| Feature | Status | Notes |
|---------|--------|-------|
| Full stats (all-time & per-year) | exists | On-demand, any range — free gets annual only |
| Taste signature | exists | Rule-based archetype in `sense-taste-signature.ts` — archetypes: forming, contrarian, genre-purist, dual-affinity, generous, selective, genre-led, eclectic, curator |
| Activity signature | exists | 52-week GitHub-style heatmap in `activity-signature.ts` |
| Streaming filters | exists | Filter catalogue by services available in user's region |
| Watchlist alerts | exists | Notified when watchlist item lands on streaming; diffs via `watchlist-streaming-alerts.ts` |
| Theater listings | planned | Nearby theatrical releases from TMDB |
| Advanced feed filters | planned | Filter feed by type: reviews / logs / ratings / person |

### Immersed ($48/yr)
Everything in Attuned, plus:

| Feature | Status | Notes |
|---------|--------|-------|
| All themes unlocked | exists | Ember + Midnight currently gated as "pro" in `app-themes.ts` — rename gate to "immersed" |
| Profile customization | exists | Accent colors (desert, copper, rose, slate) + banner frames (none, cinema, editorial) in `profile-appearance.ts` |
| Pinned reviews & custom list covers | exists | |
| Private lists & list collaboration | exists | `list-view-access.ts` + `list-collaborator-access.ts` |
| Taste overlap scores | exists | Engine in `sense-taste-overlap.ts` — needs UI surfacing as Immersed feature |
| Rivalry mode | planned | Head-to-head taste challenge + shareable card; builds on overlap engine |
| Full badge collection & prestige unlocks | exists | Bronze→Silver→Gold→Platinum→Legendary in `badge-prestige.ts` |
| Completionist challenges | exists | Nolan, Horror Canon, Ghibli, A24 in `completionist-challenges.ts` |
| Leaderboard visibility | exists | Route exists in `routes/leaderboard.ts` — visibility gating is net-new |

### Devoted ($100/yr)
Everything in Immersed, plus:

| Feature | Status | Notes |
|---------|--------|-------|
| Vote on upcoming features | planned | Private roadmap board |
| Beta access | planned | Pre-release feature access |
| Direct feedback channel to team | planned | Private channel, not a ticket queue |
| Inner circle community | planned | Discord or equivalent |
| Name in app credits | planned | Permanent, accumulates by tenure |
| Devoted badge on profile | planned | Visible to all users |
| Public supporters page listing | planned | Profiles linked from supporters page |
| Seasonal exclusive themes | planned | Time-limited, never available to other tiers |
| Rare badges (Devoted-only) | planned | Permanent identity markers, no other path to unlock |

---

## Page: `/staff/plans`

### Access control
Server-gated identical to `/staff`. Roles with access: `owner`, `admin`, `moderator`, `support`. Non-staff redirected to `/home`.

### Two views (toggle in topbar)

**Grid view** (default)
- Feature matrix: rows = features, columns = Still / Attuned / Immersed / Devoted
- Green dot = exists, amber dot = planned next to each feature name
- ✓ / — per cell showing which tiers include the feature
- Click any row → inline edit panel expands in-place below that row (no modal, no drawer)
- Inline edit panel fields: feature name, description, tier assignments (chip toggles), build status (exists / planned)
- Save / Cancel buttons inside the panel
- Optimistic update on save; error toast on failure

**Details view**
- Per-plan sections (Still → Attuned → Immersed → Devoted)
- Each feature shown as: name + full plain-language description
- Hover on any feature row → edit icon appears (✎)
- Click edit icon → same inline edit panel as grid view (slides in below the row)

### Presence (topbar)

Reuses the existing listing presence infrastructure:
- New room ID: `staff:plans` — add `staffPlansRoomId()` to `packages/realtime/src/room-ids.ts`
- Hook: `useListingPresence` with `roomId = staffPlansRoomId()`; `listingKind` is not applicable so the hook will need a small generic wrapper (`usePagePresence`) or a direct `roomId` prop (the hook already supports `roomId?: string` override — use that)
- Heartbeat interval: same 25s as listing presence
- Avatar stack in topbar: max 5 avatars, then +N pill (listing presence uses max 3 — increase for staff context)
- **Tooltip on hover** (not drawer on click): wrap each avatar in Radix `<Tooltip>` — content shows `displayName · role`. Use the app's existing Radix Tooltip import from `@still/ui` or `@radix-ui/react-tooltip`
- Online dot: same `PatronPortraitWithMetalTier` component, `showOnlineStatus`

### Create new feature — drawer

Pattern: `DetailVaulSheet` (vaul) + zustand store, identical to `PatronWatchLedgerDrawerRoot`.

**Store** (`use-plan-feature-drawer.ts`):
```ts
type PlanFeatureDrawerStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};
```

**Drawer component** (`plan-feature-create-drawer.tsx`):
- Title: "Add feature"
- Description: "New feature will appear in the grid and details view immediately."
- Fields:
  - Feature name (text input)
  - Description (textarea — plain language, shown on pricing page)
  - Available in tiers (chip multi-select: Still / Attuned / Immersed / Devoted)
  - Build status (chip toggle: exists / planned)
- Footer: Cancel + "Create feature" submit button
- On submit: `POST /api/staff/plan-features` → optimistic append + toast
- Mounted once in the staff plans page shell (same pattern as ledger drawer roots)

---

## Data layer

### New DB tables (Drizzle)

**`plan_tier`** — static reference, seeded once:
```
id: text (pk) — "still" | "attuned" | "immersed" | "devoted"
name: text — display name
sortOrder: integer — 0–3
priceYearly: integer (cents, nullable) — null = free
priceMonthly: integer (cents, nullable) — null = free
tagline: text
createdAt: timestamp
```

**`plan_feature`**:
```
id: cuid (pk)
name: text
description: text
buildStatus: text — "exists" | "planned"
sortOrder: integer
createdAt: timestamp
updatedAt: timestamp
```

**`plan_feature_tier`** (join table):
```
featureId: text → plan_feature.id
tierId: text → plan_tier.id
primary key: (featureId, tierId)
```

### Server routes (Elysia, under `/api/staff/plan-features`)

All routes require staff role (same auth guard as existing `/api/staff` routes).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/staff/plan-features` | List all features with tier assignments |
| POST | `/api/staff/plan-features` | Create feature |
| PATCH | `/api/staff/plan-features/:id` | Update name / description / status / tiers |
| DELETE | `/api/staff/plan-features/:id` | Delete feature |

GET also returns `plan_tier` rows so the client can render column headers without a second request.

---

## Component tree

```
/staff/plans (page.tsx — server component, auth gate)
└── StaffPlansShell (client — presence + view toggle state)
    ├── StaffPlansTopbar
    │   ├── presence avatars (Radix Tooltip per avatar)
    │   ├── ViewToggle (Grid / Details)
    │   └── AddFeatureButton → opens drawer
    ├── StaffPlansGridView (when toggle = "grid")
    │   ├── plan grid table
    │   └── PlanFeatureInlineEditPanel (per expanded row)
    ├── StaffPlansDetailsView (when toggle = "details")
    │   ├── per-tier sections
    │   └── PlanFeatureInlineEditPanel (per hovered + clicked row)
    └── PlanFeatureCreateDrawerRoot (mounted once)
        └── DetailVaulSheet → PlanFeatureCreateForm
```

---

## Design patterns to follow

- **Dark theme vars**: `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground` — no hardcoded hex
- **Border radius**: cards 16-24px (`rounded-2xl`), inputs `rounded-full`, chips `rounded-full`
- **Buttons**: pill shape (`rounded-full`), primary = `bg-foreground text-background`, ghost = border-only
- **Toasts**: `sonner` (`toast.success`, `toast.error`) — same as `staff-users-tab.tsx`
- **Drawer**: `DetailVaulSheet` from `@/components/movie/detail-vaul-sheet` — do not use shadcn Sheet
- **Tooltip**: Radix Tooltip from `@still/ui` or direct `@radix-ui/react-tooltip` — check existing usage in codebase before importing
- **Loading states**: skeleton or spinner consistent with existing staff components
- **No ads gate**: the existing `isPro` boolean in the user schema maps to "immersed" tier for now — this spec does not change enforcement logic, only adds the catalogue

---

## Out of scope

- Actual subscription payment / Stripe integration
- Enforcement of feature gates in production (existing `isPro` → "immersed" mapping is separate work)
- Public-facing pricing page (separate implementation)
- Devoted tier infrastructure (credits page, beta access system, etc.)
