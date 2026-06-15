# Sense — Sound layer (micro-feedback → voice reviews)

**Status:** Approved (2026-06-13)  
**Date:** 2026-06-13  
**Topic:** Extend Phase 7 theater audio with scarce milestone feedback, then ship optional voice reviews as a Letterboxd-class differentiator  
**Parent:** Phase 7 (`.cursor/scratchpad.md`), [`sense-media-platform-strategy.md`](../../../sense-media-platform-strategy.md) (Tier 4 identity, anti–shallow-dopamine)  
**Deferred:** Soundtrack snippets (licensing), ambient mood playlists (licensing + session product), podcast embeds (editorial track)

## Summary

Letterboxd is silent; Sense already has an **opt-in, gesture-gated** audio foundation (`CinemaSoundProvider`, projector hum, reel clack). This spec adds two shippable layers in order:

1. **Phase D — Micro-audio feedback** — extend the existing Web Audio stack with a small set of CC0 cues for **high-signal moments only** (diary log, prestige badge unlock, streak milestone). No chimes on every like or follow.
2. **Phase B — Voice reviews** — optional **≤90s** voice attachment on movie/TV reviews, stored in Vercel Blob, played inline in the review reader, carousel, and feed cards. Text body remains supported; audio-only reviews allowed when voice is present.

Soundtrack clips, browse ambient playlists, and podcast embeds stay **out of scope** until a licensing/embed strategy exists.

## Problem

| Gap | Impact |
|-----|--------|
| Cinema platform with no *content* audio | Detail pages feel visually rich but emotionally flat vs. the medium |
| Badge/streak rewards are visual-only | Tier-4 identity moments miss a satisfying completion cue |
| Reviews are text-only | Patron voice and warmth — core to taste identity — don't translate |
| Single `theaterAudio` toggle | Future feedback vs. atmosphere can't be tuned independently |

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Ship order | **D → B** (micro-feedback first, voice reviews second) |
| Soundtrack snippets | **Defer** — rights/licensing gate |
| Ambient playlists | **Defer** — separate product + licensing |
| Podcast embeds | **Defer** — editorial track |
| Like/follow chimes | **No** — shallow dopamine; conflicts with strategy doc |
| Audio default | **Off** — patron opts in via Settings (inherits Phase 7 posture) |
| Reduced motion | **Hard mute** all playback (existing rule) |
| Voice review scope v1 | **Movie + TV** reviews (parity with text composer) |
| Transcription | **Defer** — no auto-caption in v1 |
| OG / SEO | Unchanged — no audio in share cards or public metadata |

## Approaches considered

### 1. Monolithic `theaterAudio` + more `play()` calls (minimal)

Add clips to `sound-provider.tsx`; call from `BadgeWatcher`, streak UI, etc. **Pros:** smallest diff. **Cons:** one toggle controls hum + chimes; hard to evolve. **Rejected** for Phase D — too coarse once voice playback lands.

### 2. Nested `preferences.audio` + extended `CinemaSoundProvider` (recommended)

Split patron prefs into **atmosphere** (projector hum on detail routes) and **feedback** (log clack, badge chime, streak chime). Single master `enabled` gate + gesture arming. Phase B adds a **playback** path for review audio URLs (HTMLAudioElement or Web Audio buffer — not bundled clips). **Chosen.**

### 3. Unified `SenseAudio` facade + HTML5 for all media

New module abstracts clips and streaming URLs. **Pros:** one API for Phase B+. **Cons:** premature abstraction before two cue types exist. **Partially adopted** — extend `useCinematicAudio` API surface instead of a new provider.

## Architecture

### Preference model

Nested under existing `profile.preferences` JSON (shallow PATCH merge unchanged):

```ts
type ProfileAudioPreferences = {
  /** Master opt-in — replaces legacy `theaterAudio` boolean. */
  enabled: boolean;
  /** Looping projector hum on movie/TV detail routes. Default mirrors `enabled`. */
  atmosphere: boolean;
  /** One-shot cues: log clack, badge chime, streak milestone. Default mirrors `enabled`. */
  feedback: boolean;
};
```

**Migration:** On read, if `preferences.audio` absent:

- `theaterAudio === true` → `{ enabled: true, atmosphere: true, feedback: true }`
- else → `{ enabled: false, atmosphere: false, feedback: false }`

On write from Settings, persist `preferences.audio` and keep writing `theaterAudio: audio.enabled` for one release cycle (backward compat). Server accepts either key during transition.

**Settings UI** (`settings-section-panels.tsx`):

- Rename section copy to **“Sense audio (experimental)”** — subline explains atmosphere vs. feedback.
- Master switch `enabled`; when on, show two sub-switches (atmosphere, feedback) defaulting on.
- Hard-mute note when `prefers-reduced-motion` is active (read-only hint, no toggle override).

### Phase D — Clip registry

Extend `CinemaSoundClip` and `SOURCE_MAP` in `sound-provider.tsx`:

| Clip id | File | Trigger | Loop |
|---------|------|---------|------|
| `projector-hum` | `/audio/projector-hum.ogg` | Movie/TV detail mount (`MovieProjectionHum`) | yes |
| `reel-clack` | `/audio/reel-clack.ogg` | Successful diary log (existing) | no |
| `curtain-rise` | `/audio/curtain.ogg` | Prestige badge unlock toast (`BadgeWatcher`) | no |
| `streak-ping` | **new** `/audio/streak-ping.ogg` | Watch streak crosses **7 / 30 / 100** days (once per milestone per patron) | no |

**Volume discipline:** feedback cues ≤0.6 gain; badge/streak slightly brighter than clack (0.55–0.65). Never stack more than one feedback cue within 400ms (debounce ref in provider).

**Badge gating:** Reuse `shouldNotifyBadgeAward()` — only prestige badges that already earn a toast also earn `curtain-rise`.

**Streak gating:** `StreakAudioWatcher` in `(app)/layout` (alongside `BadgeWatcher`):

- Persist `preferences.audio.streakMilestonesCelebrated: number[]` on the server (PATCH merge when a milestone fires) so refresh/navigation does not replay.
- Fire only when `currentStreak` **equals** 7, 30, or 100 immediately after streak snapshot updates from a diary log — not on passive poll/page load.

**Explicitly no audio for:** `review.liked`, follows, comments, chat, generic toasts.

### Phase B — Data model

Add nullable columns on `review` (migration + `_journal.json`):

| Column | Type | Notes |
|--------|------|-------|
| `audio_url` | `text` | Vercel Blob public URL |
| `audio_duration_ms` | `integer` | Client-reported; server validates bounds |
| `audio_mime_type` | `text` | `audio/webm` or `audio/mp4` (Safari) |

**Constraints:**

- Max duration **90s**; max upload **8 MB**
- Allowed MIME: `audio/webm`, `audio/mp4`, `audio/ogg`
- `body` may be empty **iff** `audio_url` is set; otherwise existing `body` required
- Visibility, spoiler flag, rating rules unchanged
- Delete review → delete blob best-effort (same pattern as list cover removal)

### Phase B — Upload pipeline

Mirror profile avatar multipart flow:

1. **Web** `POST /api/reviews/:id/audio` → `proxyMultipartUpstream` → Elysia
2. **Server** `vercel-blob-audio-put.ts` (new, parallel to `vercel-blob-image-put.ts`) — validate MIME/size, `put()` with `access: "public"`, return `{ url, durationMs, mimeType }`
3. **PATCH** review row with audio fields (owner only; review must exist and not be removed)

**Rate limit:** 10 uploads / hour / user (align with import limits spirit).

**Create flow:** Text review posts first (`POST /api/reviews`); optional second step uploads audio before publish completes, **or** composer holds blob in memory and uploads after `reviewId` returned — prefer **post-create upload** to keep idempotent review creation.

### Phase B — Recording UI

In `review-composer.tsx`:

- Segmented control or pill: **Text · Voice · Both** (default Text for existing patrons)
- **Voice mode:** `MediaRecorder` with `audio/webm;codecs=opus` fallback chain; max 90s auto-stop; show elapsed timer + **Re-record** + **Delete**
- No waveform v1 — timer + red recording dot sufficient
- Publish disabled until ≥3s recorded or non-empty body
- Mobile: no autofocus; tap **Record** to start (iOS gesture policy)

### Phase B — Playback UI

Shared `ReviewAudioPlayer` client component:

- Compact pill: play/pause, `m:ss` duration, thin progress bar (no heavy chrome; matches flat feed tiles)
- `preload="none"`; user gesture starts playback
- Respects master `preferences.audio.enabled` for **auto** cues only — **voice review playback is always user-initiated** (explicit play tap), not gated by atmosphere toggle
- Separate pref not required for voice playback (content the patron chose to hear)

Surfaces:

- `ReviewCard`, `MovieDetailReviewsCarousel` slide, `review-detail-sheet` reader (below byline, above body)
- Profile pinned reviews strip

**Feed autoplay:** **Never** — tap to play only.

### Error handling

| Case | Behavior |
|------|----------|
| Upload fail | Toast + keep local recording for retry |
| Blob missing on read | Hide player; show text body only |
| `AudioContext` suspended | Voice player uses `HTMLAudioElement` ( simpler than Web Audio for streaming URLs ) |
| Staff removal | Clear audio columns + delete blob |
| Reduced motion | Feedback cues muted; voice player still available on explicit tap (accessibility — patron control) |

### Testing

**Phase D**

- Unit: preference migration helper (`theaterAudio` → `audio` object)
- Manual: toggle off → no cues; atmosphere off → no hum but feedback on; reduced motion → silence

**Phase B**

- Server: upload rejects over-size, wrong MIME, non-owner, duration >90s
- Web: composer records/stops; player play/pause; empty body + audio publishes
- Manual: iOS Safari record + playback path

### Metrics (instrument later)

- `product_event`: `audio.feedback.played` (clip id), `review.voice.published`, `review.voice.played`
- Funnel: % reviews with audio, listen-through rate at 50%/90%

## Out of scope (future tracks)

| Track | Blocker |
|-------|---------|
| **A — Soundtrack snippets** | Label/sync licensing (Spotify/Apple/TMDb does not ship playable score URLs) |
| **C — Ambient browse playlists** | Streaming license or large CC0 curation + session UX |
| **E — Podcast embeds** | Editorial sourcing + oEmbed/legal review |
| Auto-transcription | Cost + moderation |
| Audio diary logs (without review) | Separate attachment model on `log` — revisit after voice reviews prove adoption |

## Implementation phases (for planning doc)

| Phase | Deliverable | Success criteria |
|-------|-------------|------------------|
| **D.1** | Preference migration + Settings sub-toggles | Round-trip PATCH; legacy `theaterAudio` honored |
| **D.2** | `curtain-rise` + `streak-ping` clips + debounce | Badge toast + streak milestone audibly fire once when enabled |
| **B.1** | DB migration + blob upload route | Owner can attach audio to existing review |
| **B.2** | Composer record flow | Publish voice review from movie detail |
| **B.3** | `ReviewAudioPlayer` in reader + carousel + feed | Tap-to-play works on desktop + mobile |

## Changelog / What's New

When Phase D ships, add a `whats-new-releases.ts` entry for granular audio settings + milestone cues. When Phase B ships, separate entry for voice reviews.
