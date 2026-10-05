# Sense Companion — toast icon colors and start labels

**Status:** Approved in chat (2026-10-03)
**Date:** 2026-10-03
**Topic:** Colored marks on the playback notice, and a first play that says Watching instead of opening as Paused

## Summary

The playback notice on a streaming page keeps one solid color per mark. A movie or episode that has not played yet does not show a pause notice. The first time it is actually playing, the notice says **Watching** and uses the green eye. A pause after that says **Paused**. Playing again says **Resuming** and uses the blue play mark.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Color style | One solid fill per mark, the same way the eye is already green or red |
| Exploring | Teal compass, `#3dccc4` |
| Viewing a title page | Violet info mark, `#c49bff` |
| First play | Green eye, `#3dcc7a`, lead word **Watching** |
| Failed save | Red eye, `#f15b5b`, lead word still **Watching** |
| Real pause | Amber pause bars, `#e8a854`, lead word **Paused** |
| Resume | Blue play mark, `#5aa2ff`, lead word **Resuming** |
| Pause before play | No notice, and that pause is not remembered |
| After a real pause | **Paused**, then **Resuming** if they play the same title again |
| New episode, or leaving and coming back | Starts over with **Watching** and the eye |
| Exploring and viewing copy | Unchanged: **Exploring** and **Viewing** |

## What the patron sees

The notice stays the existing dark pill: icon, lead word, title, and the episode line when there is one.

| Moment | Lead | Mark |
|--------|------|------|
| Catalogue or home | Exploring | Teal compass |
| Movie or show page, before playback | Viewing | Violet info |
| First time this movie or episode is playing | Watching | Green eye |
| That save is not accepted | Watching | Red eye |
| Pause after it has played | Paused | Amber bars |
| Play again after that pause | Resuming | Blue play mark |

**Watching** is only the eye. **Resuming** is only the play mark. A failed save does not recolor **Resuming**.

## Behavior

The notice already appears when the mode or the title changes. This adds one gate.

A title is the same movie or episode when the title, season, and episode match. A pause counts only when that title is already remembered as playing, or as paused after a play. A pause before that returns the previous notice state unchanged and shows nothing.

The first playing update for that title is not a resume, so the lead is **Watching** and the mark is the eye. A later pause shows **Paused**. The next play of that same title is a resume, so the lead is **Resuming** and the mark is the play triangle.

A different episode does not inherit the previous title’s pause. Clearing the notice when the player goes quiet, which already happens, also forgets the pause. The next play is **Watching** again.

A pause that arrives after a real play still counts, even if it is brief. There is no extra delay.

An episode that has a season number but no episode number still waits, as it does today, and does not count as a play or a pause.

## Units

**Notice decision** (`apps/sense-companion/src/presence/watch-toast.ts`). `nextWatchToast` drops a pause that happens before this title has played, and does not store it. `watchToastCopy` uses **Watching** with the eye for a first play, and **Resuming** with the play mark for a resume. Exploring, viewing, and paused copy stay as they are.

**Notice paint** (`apps/sense-companion/src/presence/watch-toast-view.ts`). Each mark gets a class and one fill: compass `#3dccc4`, info `#c49bff`, eye `#3dcc7a`, eye error `#f15b5b`, pause `#e8a854`, play `#5aa2ff`. The pill, type, and motion stay as they are.

**Pages.** `streaming.content.ts` and `generic-video.content.ts` already ask `nextWatchToast` and `watchToastCopy` what to show. They do not grow a timer. A playing notice, including **Resuming**, still waits for the save result before it paints. Only the eye turns red when that result fails.

## Error handling

- Pause before any play: show nothing, and leave the remembered notice as it was.
- Save fails on **Watching**: red eye, lead stays **Watching**.
- Save fails on **Resuming**: the notice still says **Resuming** and the play mark stays blue.
- Player goes quiet: remembered title is cleared, as today.

## Testing

Unit tests on `nextWatchToast` and `watchToastCopy` cover: a pause before play shows nothing and is not remembered; the first play is **Watching** with the eye; a pause after that play is **Paused**; the next play is **Resuming** with the play mark; a new episode starts again at **Watching**.

The view is not unit-tested for the fills. A manual check is: open a title and confirm the first notice is **Watching** with the green eye, pause and see amber **Paused**, play again and see blue **Resuming**, then switch episode and see the eye again.

## Non-goals

- Recoloring the Discord card, the logged-rate toast, or the auto-log countdown
- A delay that hides a pause after playback has already started
- Changing when exploring or viewing notices appear
