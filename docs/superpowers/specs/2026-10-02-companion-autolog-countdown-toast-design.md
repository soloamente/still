# Sense Companion — auto-log countdown toast

**Status:** Approved in chat (2026-10-02) — pending spec review
**Date:** 2026-10-02
**Topic:** A playback pill that tells the patron how long is left before Sense logs the title, then becomes a frozen-on-pause countdown ring

## Summary

When a paired browser is within **15 minutes** of the existing auto-log point, one pill appears on the streaming page. It starts as a sentence with a gold hourglass and a minute badge. After **4 seconds** the same pill shrinks into a ring clock that follows the playhead. Pause freezes the clock and the pill stays. Crossing the log point removes the clock so the existing rate toast can take over.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Shape | **One pill, two phases.** Not two toasts, and not a clock that only explains itself on hover |
| When it appears | Remaining time until the log point is **greater than 0** and **at most 15 minutes** |
| Log point | Unchanged: **90%** of runtime, and only when runtime is **at least 10 minutes** (`COMPANION_AUTO_LOG_RATIO`, `COMPANION_AUTO_LOG_MIN_DURATION_SEC`) |
| First phase | Gold hourglass, the words **Log in**, minutes left in a dark badge such as **12 min**. No **Keep?** |
| Second phase | After **4 seconds**, the same pill becomes the ring clock. The number is time left (`12:04`). The ring fills as the playhead approaches the log point |
| Pause | Clock and ring **freeze**. The pill **stays** |
| Seek out | If more than 15 minutes remain again, the pill **hides** |
| Seek back in | Clock only. The sentence does not play again for that title |
| End | At the log point the clock leaves. The existing logged toast (rate 0–10) is unchanged |
| Unpaired | The pill never appears. A log will not be written |
| Short titles | Runtime under 10 minutes: never appear |

## What the patron sees

The pill sits in the same top-right corner as the playback notice. It does not dismiss on its own and it does not use the playback notice’s hover timer.

**Sentence.** Hourglass on the left, tinted gold. Then **Log in** in the same white weight as the playback notice title. Then a darker inset badge with the minutes still left, rounded **up** to a whole minute, minimum **1 min** while any time remains. There is no trailing question.

**Clock.** The pill narrows over **220ms** (instant when reduced motion is on). The time is the only label. Seconds are zero-padded (`9:05`, `0:42`). The ring is a track around the pill; the bright arc is how much of this 15-minute window has been used. At 15:00 left the arc is empty. At the log point it is full. Pause leaves both the digits and the arc where they were. Play continues from the playhead, not from a wall clock.

**Handoff.** When remaining time reaches 0, or the helper reports the diary row, the clock slides away. The rate toast is the one that already exists. This pill does not ask for a rating.

## Behavior

Remaining time is `duration * 0.9 - position`, in seconds. Missing, non-finite, or out-of-range position or duration shows nothing.

A title key is the provider, kind, title, season, and episode. A new key resets the “sentence already shown” flag.

| Situation | Pill |
|-----------|------|
| Not paired, or runtime under 10 minutes, or remaining ≤ 0, or remaining > 15 minutes | Hidden |
| First time this key is inside the window, playing or paused | Sentence for 4 seconds, then clock |
| Same key, sentence already finished, still inside the window | Clock |
| Pause inside the window | Stay on the last remaining time |
| Seek outside, then back in | Clock, skip the sentence |
| Playhead reaches the log point, or a logged notice arrives for this title | Hide |

The 4-second sentence uses a timer. Pause does not restart it. If they pause during the sentence, the sentence still ends and the frozen clock remains.

## Units

**Countdown math** (`apps/sense-companion/src/presence/autolog-countdown.ts`). Pure. Given position, duration, paused, and whether this key already showed the sentence, it returns hidden, sentence, or clock, plus the remaining seconds to display. No DOM.

**Countdown pill** (`apps/sense-companion/src/presence/autolog-countdown-view.ts`). One shadow host. Sentence and clock are two layouts of that host. The width change is a short transform. `prefers-reduced-motion` snaps the width and still updates the digits. The hourglass is the supplied icon, filled with **`#e8a854`**.

**Page tick.** `streaming.content.ts` and `generic-video.content.ts` already see each playback update. They ask the math module what to show and call the view. They do not start a second clock. Pairing comes from the same helper result that already reports whether a save was paired. Until that result is known, the pill stays hidden.

The playback “Watching” notice is unchanged. It still appears when a title starts, which is normally long before this window.

## Error handling

- No duration or position: hide.
- Helper unreachable or unpaired: hide, and do not promise a log.
- Logged notice and countdown can arrive together: countdown hides; the rate toast still shows once per log id, as it does today.

## Testing

Unit tests on the math module cover: outside the window, first entry (sentence), the same key after the sentence flag (clock), pause keeping the previous remaining seconds, seek out then in (clock only), a new episode resetting the sentence, runtime under 10 minutes, and remaining at or below 0.

The view is not unit-tested beyond what the math decides. A manual check is: start a long title near the end, see **Log in** and the badge, see it become the ring, pause and confirm the digits stick, resume, then cross the log point and get the rate toast.

## Non-goals

- Changing the 90% or 10-minute auto-log rule
- Changing the rate toast, Discord card, or the “Watching” playback notice
- A live minute badge that stays in the sentence for the whole window
- Showing the pill on Sense pages that are not the playing tab
