# Sense Sound Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Phase 7 opt-in audio with granular feedback cues (badge + streak milestones), then ship optional ≤90s voice review attachments with tap-to-play surfaces across the community layer.

**Architecture:** Nested `preferences.audio` replaces coarse `theaterAudio`; `CinemaSoundProvider` gates clips by `enabled` + `atmosphere`/`feedback` + gesture + reduced motion. Phase B adds nullable `review.audio_*` columns, Vercel Blob upload via multipart proxy, `MediaRecorder` in composer, `HTMLAudioElement` player in feed/reader.

**Tech Stack:** Next.js App Router, Elysia, Drizzle/Neon, Web Audio API, MediaRecorder, Vercel Blob, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-13-sense-sound-layer-design.md`](../specs/2026-06-13-sense-sound-layer-design.md)

---

## Conventions

- Pref namespace: `preferences.audio` with keys `enabled`, `atmosphere`, `feedback`, `streakMilestonesCelebrated` (number array)
- Legacy: keep writing `theaterAudio: audio.enabled` from Settings for one release
- Clip files live in `apps/web/public/audio/` — CC0, ≤50KB, Opus OGG preferred
- Tests: `bun:test`, colocated `*.test.ts`
- After code changes: `graphify update .`
- Do **not** commit unless the human asks
- Executor: **one task at a time**; human verifies before next task

---

## File structure

**Phase D — create**

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/profile-audio-preferences.ts` | Read/normalize/migrate `preferences.audio` from legacy `theaterAudio` |
| `apps/web/src/lib/profile-audio-preferences.test.ts` | Migration + default tests |
| `apps/server/src/lib/profile-audio-preferences.ts` | Server mirror for PATCH sanitize |
| `apps/server/src/lib/profile-audio-preferences.test.ts` | Server tests |
| `apps/web/src/components/gamification/streak-audio-watcher.tsx` | Milestone detection + PATCH celebrate + `play("streak-ping")` |
| `apps/web/public/audio/streak-ping.ogg` | New CC0 cue (source from freesound.org, commit ≤50KB) |

**Phase D — modify**

| File | Change |
|------|--------|
| `apps/web/src/components/cinema/sound-provider.tsx` | Clip registry, atmosphere/feedback gates, debounce |
| `apps/web/src/components/cinema/movie-projection-hum.tsx` | Use `atmosphereEnabled` not master-only |
| `apps/web/src/components/movie/use-movie-detail-user-state.ts` | Gate `reel-clack` on `feedbackEnabled` |
| `apps/web/src/components/tv/use-tv-detail-user-state.ts` | Same as movie |
| `apps/web/src/components/gamification/badge-watcher.tsx` | `play("curtain-rise")` on prestige toast |
| `apps/web/src/components/profile/settings-section-panels.tsx` | Master + sub-toggles UI |
| `apps/web/src/components/profile/settings-form-context.tsx` | State, dirty, PATCH for `audio` object |
| `apps/web/src/components/profile/me-account-session-context.tsx` | Expose normalized audio prefs if needed |
| `apps/web/src/lib/whats-new-releases.ts` | Phase D changelog entry when D.2 ships |

**Phase B — create**

| File | Responsibility |
|------|----------------|
| `packages/db/src/migrations/0027_review_audio.sql` | `audio_url`, `audio_duration_ms`, `audio_mime_type` on `review` |
| `apps/server/src/lib/vercel-blob-audio-put.ts` | MIME/size validation + Blob put |
| `apps/server/src/lib/vercel-blob-audio-put.test.ts` | Validation tests |
| `apps/server/src/lib/review-audio.ts` | Allowed MIME, max bytes/duration helpers |
| `apps/server/src/lib/review-audio.test.ts` | Helper tests |
| `apps/web/src/app/api/reviews/[id]/audio/route.ts` | Multipart proxy to Elysia |
| `apps/web/src/lib/upload-review-audio.ts` | Browser upload helper |
| `apps/web/src/components/review/review-audio-player.tsx` | Tap-to-play pill player |
| `apps/web/src/components/review/review-audio-recorder.tsx` | MediaRecorder UI for composer |

**Phase B — modify**

| File | Change |
|------|--------|
| `packages/db/src/schema/activity.ts` | Review audio columns |
| `packages/db/src/migrations/meta/_journal.json` | Register `0027` |
| `apps/server/src/routes/reviews.ts` | POST `/:id/audio`, relax body validation, serialize audio fields |
| `apps/server/src/routes/movies.ts` | Include audio fields in review list payloads if needed |
| `apps/web/src/components/review/review-composer.tsx` | Text/Voice/Both mode + upload after create |
| `apps/web/src/components/review/review-card.tsx` | Player when `audioUrl` present |
| `apps/web/src/components/review/review-detail-sheet.tsx` | Player in reader |
| `apps/web/src/components/movie/movie-detail-reviews-carousel.tsx` | Player on slides |
| `apps/web/src/components/profile/profile-pinned-review-card.tsx` | Player |
| `apps/web/src/lib/whats-new-releases.ts` | Phase B changelog entry |

---

## Phase D — Micro-audio feedback

### Task 1: Shared `profile-audio-preferences` helpers (web)

**Files:**
- Create: `apps/web/src/lib/profile-audio-preferences.ts`
- Create: `apps/web/src/lib/profile-audio-preferences.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
  PROFILE_PREF_AUDIO,
  PROFILE_PREF_THEATER_AUDIO,
  mergeProfileAudioPreferences,
  readProfileAudioPreferences,
} from "./profile-audio-preferences";

describe("readProfileAudioPreferences", () => {
  test("defaults all off", () => {
    expect(readProfileAudioPreferences(null)).toEqual({
      enabled: false,
      atmosphere: false,
      feedback: false,
      streakMilestonesCelebrated: [],
    });
  });

  test("migrates legacy theaterAudio true", () => {
    expect(readProfileAudioPreferences({ theaterAudio: true })).toEqual({
      enabled: true,
      atmosphere: true,
      feedback: true,
      streakMilestonesCelebrated: [],
    });
  });

  test("reads nested audio object", () => {
    expect(
      readProfileAudioPreferences({
        audio: { enabled: true, atmosphere: false, feedback: true },
      }),
    ).toEqual({
      enabled: true,
      atmosphere: false,
      feedback: true,
      streakMilestonesCelebrated: [],
    });
  });
});

describe("mergeProfileAudioPreferences", () => {
  test("writes audio + legacy theaterAudio", () => {
    const next = mergeProfileAudioPreferences({}, {
      enabled: true,
      atmosphere: true,
      feedback: false,
      streakMilestonesCelebrated: [7],
    });
    expect(next[PROFILE_PREF_AUDIO]?.enabled).toBe(true);
    expect(next[PROFILE_PREF_THEATER_AUDIO]).toBe(true);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `cd apps/web && bun test src/lib/profile-audio-preferences.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement helpers**

```ts
export const PROFILE_PREF_AUDIO = "audio" as const;
export const PROFILE_PREF_THEATER_AUDIO = "theaterAudio" as const;

export type ProfileAudioPreferences = {
  enabled: boolean;
  atmosphere: boolean;
  feedback: boolean;
  streakMilestonesCelebrated: number[];
};

const STREAK_MILESTONES = [7, 30, 100] as const;

export function readProfileAudioPreferences(
  prefs: Record<string, unknown> | null | undefined,
): ProfileAudioPreferences {
  const raw = prefs?.[PROFILE_PREF_AUDIO];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      enabled: o.enabled === true,
      atmosphere: o.atmosphere !== false && o.enabled === true,
      feedback: o.feedback !== false && o.enabled === true,
      streakMilestonesCelebrated: normalizeMilestoneArray(o.streakMilestonesCelebrated),
    };
  }
  const legacy = prefs?.[PROFILE_PREF_THEATER_AUDIO] === true;
  return {
    enabled: legacy,
    atmosphere: legacy,
    feedback: legacy,
    streakMilestonesCelebrated: [],
  };
}

function normalizeMilestoneArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is number => typeof n === "number" && STREAK_MILESTONES.includes(n as 7 | 30 | 100));
}

export function mergeProfileAudioPreferences(
  existing: Record<string, unknown>,
  audio: ProfileAudioPreferences,
): Record<string, unknown> {
  return {
    ...existing,
    [PROFILE_PREF_AUDIO]: {
      enabled: audio.enabled,
      atmosphere: audio.atmosphere,
      feedback: audio.feedback,
      streakMilestonesCelebrated: audio.streakMilestonesCelebrated,
    },
    [PROFILE_PREF_THEATER_AUDIO]: audio.enabled,
  };
}

export const STREAK_AUDIO_MILESTONES = STREAK_MILESTONES;
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `cd apps/web && bun test src/lib/profile-audio-preferences.test.ts`  
Expected: PASS

- [ ] **Step 5: Human verify checkpoint** — Planner confirms tests green before Task 2

---

### Task 2: Server mirror + PATCH sanitize

**Files:**
- Create: `apps/server/src/lib/profile-audio-preferences.ts`
- Create: `apps/server/src/lib/profile-audio-preferences.test.ts`
- Modify: `apps/server/src/routes/profiles.ts` — import helpers in PATCH merge path (where other prefs are sanitized)

- [ ] **Step 1:** Copy web helpers to server (same exports; no `@/` imports)
- [ ] **Step 2:** Add tests mirroring Task 1
- [ ] **Step 3:** In profiles PATCH handler, when `body.preferences.audio` present, coerce via `readProfileAudioPreferences(merged)` before persist
- [ ] **Step 4:** Run `cd apps/server && bun test src/lib/profile-audio-preferences.test.ts`
- [ ] **Step 5: Human verify** — PATCH `/api/profiles/me` with `{ preferences: { audio: { enabled: true, atmosphere: false, feedback: true } } }` round-trips

---

### Task 3: Settings UI — master + sub-toggles

**Files:**
- Modify: `apps/web/src/components/profile/settings-form-context.tsx`
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`

- [ ] **Step 1:** Replace single `theaterAudio` boolean state with `ProfileAudioPreferences` via `readProfileAudioPreferences(profile.preferences)` on load
- [ ] **Step 2:** On save, call `mergeProfileAudioPreferences` and `setTheaterAudioEnabled(audio.enabled)` for live provider sync
- [ ] **Step 3:** Settings panel copy:

```tsx
// Master: id="sense-audio-enabled" label="Sense audio (experimental)"
// Sub (visible when enabled):
//   id="sense-audio-atmosphere" — "Atmosphere — projector hum on film pages"
//   id="sense-audio-feedback" — "Feedback — log clack and milestone chimes"
// Hint when matchMedia('(prefers-reduced-motion: reduce)'): "Reduced motion is on — audio cues stay muted."
```

- [ ] **Step 4:** Manual verify on `/me/settings` — toggle combinations persist after reload
- [ ] **Step 5: Human verify checkpoint**

---

### Task 4: Extend `CinemaSoundProvider`

**Files:**
- Modify: `apps/web/src/components/cinema/sound-provider.tsx`
- Modify: `apps/web/src/components/cinema/movie-projection-hum.tsx`
- Modify: `apps/web/src/components/movie/use-movie-detail-user-state.ts`
- Modify: `apps/web/src/components/tv/use-tv-detail-user-state.ts`

- [ ] **Step 1:** Extend type:

```ts
export type CinemaSoundClip =
  | "projector-hum"
  | "reel-clack"
  | "curtain-rise"
  | "streak-ping";
```

Add to `SOURCE_MAP`: `curtain-rise: "/audio/curtain.ogg"`, `streak-ping: "/audio/streak-ping.ogg"`

- [ ] **Step 2:** Load prefs with `readProfileAudioPreferences`; expose:

```ts
type CinematicAudioValue = {
  audioPreferences: ProfileAudioPreferences;
  preferencesLoaded: boolean;
  setTheaterAudioEnabled: (enabled: boolean) => void; // keep for compat — sets all three when toggled from legacy callers
  play: (name: CinemaSoundClip, opts?: { category?: "atmosphere" | "feedback" }) => Promise<void>;
  // ...
};
```

- [ ] **Step 3:** Gate logic in `play()`:

```ts
const category = opts?.category ?? (name === "projector-hum" ? "atmosphere" : "feedback");
if (!prefs.enabled) return;
if (category === "atmosphere" && !prefs.atmosphere) return;
if (category === "feedback" && !prefs.feedback) return;
```

Add `lastFeedbackPlayRef` — skip if `Date.now() - last < 400`

- [ ] **Step 4:** One-shot gain for new clips: `curtain-rise` 0.62, `streak-ping` 0.58 (≤0.65)

- [ ] **Step 5:** `MovieProjectionHum` — no change to call signature; provider handles atmosphere gate internally

- [ ] **Step 6:** Movie/TV log success — `play("reel-clack", { category: "feedback" })`

- [ ] **Step 7: Human verify** — atmosphere off + feedback on → no hum on `/movies/[id]`, clack still fires on log

---

### Task 5: Badge + streak watchers

**Files:**
- Modify: `apps/web/src/components/gamification/badge-watcher.tsx`
- Create: `apps/web/src/components/gamification/streak-audio-watcher.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Create: `apps/web/public/audio/streak-ping.ogg`

- [ ] **Step 1:** Source CC0 streak ping from freesound.org (≤50KB OGG); commit as `streak-ping.ogg`

- [ ] **Step 2:** In `badge-watcher.tsx` after prestige toast:

```ts
import { useCinematicAudio } from "@/components/cinema/sound-provider";
// inside poll loop after toast.success:
void play("curtain-rise", { category: "feedback" }).catch(() => undefined);
```

- [ ] **Step 3:** Implement `StreakAudioWatcher`:

```tsx
"use client";
/** Celebrates 7/30/100-day streak milestones once — persists to preferences.audio.streakMilestonesCelebrated */
export function StreakAudioWatcher() {
  const { play, audioPreferences, preferencesLoaded } = useCinematicAudio();
  const { streak } = useWatchStreak();
  const celebratedRef = useRef(new Set(audioPreferences.streakMilestonesCelebrated));

  useEffect(() => {
    if (!preferencesLoaded || !streak?.currentStreak) return;
    const n = streak.currentStreak;
    if (!STREAK_AUDIO_MILESTONES.includes(n as 7 | 30 | 100)) return;
    if (celebratedRef.current.has(n)) return;
    celebratedRef.current.add(n);
    void play("streak-ping", { category: "feedback" });
    void api.api.profiles.me.patch({
      preferences: mergeProfileAudioPreferences({}, {
        ...audioPreferences,
        streakMilestonesCelebrated: [...celebratedRef.current],
      }),
    });
  }, [streak?.currentStreak, preferencesLoaded, play, audioPreferences]);
  return null;
}
```

Refine: only PATCH milestone array (shallow merge with existing prefs from profile context) — do not clobber unrelated keys.

Trigger only when streak increases to milestone (compare previous ref), not on initial page load hit — store `prevStreakRef`.

- [ ] **Step 4:** Mount `<StreakAudioWatcher />` next to `<BadgeWatcher />` in `app-shell.tsx`

- [ ] **Step 5:** Add `whats-new-releases.ts` entry for Phase D

- [ ] **Step 6: Human verify** — enable feedback; unlock prestige badge → hear curtain; hit 7-day streak (or seed test account) → hear ping once

**Phase D deliverable complete.** Planner sign-off before Phase B.

---

## Phase B — Voice reviews

### Task 6: DB migration + schema

**Files:**
- Create: `packages/db/src/migrations/0027_review_audio.sql`
- Modify: `packages/db/src/schema/activity.ts`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE "review" ADD COLUMN "audio_url" text;
ALTER TABLE "review" ADD COLUMN "audio_duration_ms" integer;
ALTER TABLE "review" ADD COLUMN "audio_mime_type" text;
```

- [ ] **Step 2:** Add to Drizzle `review` table:

```ts
audioUrl: text("audio_url"),
audioDurationMs: integer("audio_duration_ms"),
audioMimeType: text("audio_mime_type"),
```

- [ ] **Step 3:** Register in `_journal.json` as `0027_review_audio`

- [ ] **Step 4:** Run `bun run db:migrate` locally

- [ ] **Step 5: Human verify** — `\d review` shows three nullable columns

---

### Task 7: Server audio upload helpers + route

**Files:**
- Create: `apps/server/src/lib/review-audio.ts`
- Create: `apps/server/src/lib/review-audio.test.ts`
- Create: `apps/server/src/lib/vercel-blob-audio-put.ts`
- Create: `apps/server/src/lib/vercel-blob-audio-put.test.ts`
- Modify: `apps/server/src/routes/reviews.ts`

- [ ] **Step 1: Failing tests for review-audio.ts**

```ts
import { describe, expect, test } from "bun:test";
import {
  REVIEW_AUDIO_MAX_BYTES,
  REVIEW_AUDIO_MAX_DURATION_MS,
  assertReviewAudioUpload,
} from "./review-audio";

describe("assertReviewAudioUpload", () => {
  test("rejects oversize file", () => {
    expect(assertReviewAudioUpload({
      size: REVIEW_AUDIO_MAX_BYTES + 1,
      type: "audio/webm",
      durationMs: 30_000,
    }).ok).toBe(false);
  });
  test("rejects duration over 90s", () => {
    expect(assertReviewAudioUpload({
      size: 1000,
      type: "audio/webm",
      durationMs: REVIEW_AUDIO_MAX_DURATION_MS + 1,
    }).ok).toBe(false);
  });
  test("accepts valid webm", () => {
    expect(assertReviewAudioUpload({
      size: 1000,
      type: "audio/webm",
      durationMs: 45_000,
    }).ok).toBe(true);
  });
});
```

- [ ] **Step 2:** Implement constants + validation (`audio/webm`, `audio/mp4`, `audio/ogg`; max 8MB; max 90_000ms)

- [ ] **Step 3:** Implement `vercelBlobAudioPut(key, file)` mirroring image put

- [ ] **Step 4:** Add route `POST /api/reviews/:id/audio`:
  - Auth required, owner only
  - Rate limit `reviews:audio:${user.id}` — 10/hour
  - Form fields: `file`, `durationMs` (integer)
  - Validate → put to `reviews/{userId}/{reviewId}.webm` → update review row
  - Return `{ audioUrl, audioDurationMs, audioMimeType }`

- [ ] **Step 5:** Relax create review validation: `body` optional when client will attach audio in follow-up; minimum rule — `body.trim().length > 0 OR willUploadAudio flag` — simplest v1: allow empty string on create if `hasVoiceAttachment: true` in body schema optional boolean

- [ ] **Step 6:** Include audio fields in GET/list serializers

- [ ] **Step 7:** Run server tests + `bun test apps/server/src/lib/review-audio.test.ts`

- [ ] **Step 8: Human verify** — curl/postman upload to existing review returns URL

---

### Task 8: Next.js multipart proxy

**Files:**
- Create: `apps/web/src/app/api/reviews/[id]/audio/route.ts`
- Create: `apps/web/src/lib/upload-review-audio.ts`

- [ ] **Step 1:** Proxy route (copy pattern from `apps/web/src/app/api/profiles/me/avatar/route.ts`):

```ts
import { proxyMultipartUpstream } from "@/lib/proxy-multipart-upstream";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return proxyMultipartUpstream(req, `/api/reviews/${id}/audio`);
}
```

- [ ] **Step 2:** Client helper:

```ts
export async function uploadReviewAudio(args: {
  reviewId: string;
  blob: Blob;
  durationMs: number;
}): Promise<{ audioUrl: string }> {
  const form = new FormData();
  form.append("file", args.blob, "voice.webm");
  form.append("durationMs", String(args.durationMs));
  const res = await fetch(stillApiOrigin() + `/api/reviews/${args.reviewId}/audio`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 3: Human verify** — upload from browser devtools through web host

---

### Task 9: `ReviewAudioPlayer` + `ReviewAudioRecorder`

**Files:**
- Create: `apps/web/src/components/review/review-audio-player.tsx`
- Create: `apps/web/src/components/review/review-audio-recorder.tsx`

- [ ] **Step 1: Player** — compact pill:

```tsx
"use client";
/** Tap-to-play voice review — HTMLAudioElement, preload="none", no autoplay */
export function ReviewAudioPlayer(props: {
  src: string;
  durationMs: number;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // play/pause button with aria-label, mm:ss label, thin progress from timeupdate
}
```

- [ ] **Step 2: Recorder** — max 90s MediaRecorder:

```tsx
export function ReviewAudioRecorder(props: {
  onRecorded: (blob: Blob, durationMs: number) => void;
  onClear: () => void;
}) {
  // pick mime: audio/webm;codecs=opus || audio/mp4 || audio/webm
  // Record / Stop / Re-record; elapsed timer; auto-stop at 90_000ms
  // Publish gate: durationMs >= 3000
}
```

- [ ] **Step 3:** Manual test in Storybook-like isolation or temporary page — record 5s, play back

- [ ] **Step 4: Human verify** — desktop Chrome record + playback

---

### Task 10: Composer integration

**Files:**
- Modify: `apps/web/src/components/review/review-composer.tsx`

- [ ] **Step 1:** Add mode state: `"text" | "voice" | "both"` via `SegmentedPillToolbar`

- [ ] **Step 2:** Show `ReviewAudioRecorder` when mode is `voice` or `both`

- [ ] **Step 3:** Publish flow:

```ts
// 1. POST review (body may be "" when voice-only)
const created = await api.api.reviews.post({ ... });
// 2. if voice blob pending:
await uploadReviewAudio({ reviewId: created.id, blob, durationMs });
// 3. toast + close + router.refresh()
```

- [ ] **Step 4:** Disable publish until `body.trim().length > 0 OR recordingDurationMs >= 3000`

- [ ] **Step 5: Human verify** — publish voice-only review from movie detail; text+voice; text-only unchanged

---

### Task 11: Surface player in community UI

**Files:**
- Modify: `apps/web/src/components/review/review-card.tsx`
- Modify: `apps/web/src/components/review/review-detail-sheet.tsx`
- Modify: `apps/web/src/components/movie/movie-detail-reviews-carousel.tsx`
- Modify: `apps/web/src/components/profile/profile-pinned-review-card.tsx`
- Modify: feed serializers/types if `audioUrl` not yet on payload

- [ ] **Step 1:** Extend review types with optional `audioUrl`, `audioDurationMs`

- [ ] **Step 2:** Render `<ReviewAudioPlayer />` below byline when `audioUrl` set; body hidden or shown per mode (voice-only: no body block)

- [ ] **Step 3:** Ensure only one `HTMLAudioElement` plays — pause others on play (optional module-level ref)

- [ ] **Step 4:** Add whats-new entry for voice reviews

- [ ] **Step 5:** Run `cd apps/web && bun run build`

- [ ] **Step 6: Human verify** — voice review appears in carousel, feed card, reader drawer, pinned strip; tap-to-play on mobile Safari

**Phase B deliverable complete.**

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Nested `preferences.audio` | 1–3 |
| Legacy `theaterAudio` migration | 1–2 |
| Atmosphere vs feedback gates | 4 |
| curtain-rise + streak-ping clips | 4–5 |
| 400ms debounce | 4 |
| Badge prestige gate | 5 |
| Streak milestone persist | 5 |
| No like/follow chimes | — (explicitly omitted) |
| Review audio columns | 6 |
| Blob upload + rate limit | 7–8 |
| Composer MediaRecorder | 9–10 |
| ReviewAudioPlayer surfaces | 11 |
| Voice playback not gated by atmosphere pref | 9 (HTMLAudioElement, user gesture) |
| Reduced motion mutes feedback cues only | 4 |
| whats-new entries | 5, 11 |
| Metrics deferred | — (post-ship) |

No placeholders remain. Type names consistent: `ProfileAudioPreferences`, `CinemaSoundClip`, `audioUrl` on API payloads (camelCase client / snake DB).

---

## Manual QA matrix (Planner)

| Case | Expected |
|------|----------|
| All audio off | Silence everywhere |
| Feedback on, atmosphere off | Clack + milestones only |
| Atmosphere on, feedback off | Hum only on detail |
| Reduced motion | No Web Audio cues; voice player still works on tap |
| Voice-only review | Publishes; player visible; empty body OK |
| Non-owner upload | 403 |
| >90s recording | Auto-stop; server rejects if bypassed |
