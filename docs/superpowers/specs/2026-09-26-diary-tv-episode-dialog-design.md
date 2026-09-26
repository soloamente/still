# Diary TV episode dialog

**Status:** Draft — pending user review
**Date:** 2026-09-26
**Scope:** `/diary` TV group cell. Films stay one poster per log.
**Replaces:** The in-grid flip-back log list in `DiaryTvGroupCell` (`2026-05-20-diary-tv-grouping-design.md`). Grouping, collapsed scrim, and radial menu stay.

## Summary

A left click on a diary TV poster flips that poster while it travels from its grid cell to the center of the page and becomes a dialog. The left side is season posters, with the season in view shown large. The right side lists every season and one pill per episode. Closing runs the same path backward into the original cell.

## Decisions

| Topic | Decision |
| --- | --- |
| Open | Left click on the poster. Right-click and long-press still open the radial menu and do not travel. |
| Motion | The tapped poster flips while it moves from the cell rect into the large season slot. Scrim, season column, and episode list fade in as it arrives. |
| Close | Escape, scrim, or close control. The poster flips and lands on that cell’s position at close time. |
| Missing cell | If a filter removed the cell, the dialog fades out and does not fly. |
| Reduced motion | Dialog opens and closes in place. No flight and no flip. |
| Left | Column of season posters. The season in view is the large poster. |
| Open season | Season of the latest episode log. If there is none, the first season in the catalogue list. |
| Right | Every season TMDb lists that has at least one episode, including Specials when it has episodes. |
| Pill | One pill per episode. |
| No episode log | Empty pill. |
| Episode logs, none rated | Neutral fill. |
| Rated | Color from the average of rated logs for that episode only. Unrated logs for the same episode do not change the average. |
| Rewatch | Several rated logs for one episode average together. The number on the pill is that average on the 0–10 diary scale (`10` at the top, not `10.0`). |
| Season log | Label on that season. Does not color pills. |
| Show log | Label under the large poster. Does not color pills. |
| Logged pill | Opens Quick Log on the latest log for that episode. The dialog stays open. A save refreshes that pill. |
| Empty pill | Not a control. |
| One dialog | Opening another TV poster closes the current one with the reverse trip first. |

## Layout

Centered dialog on the lobby. No borders, rings, or decorative shadows. The dialog surface is `bg-card`. Season column and episode groups sit on `bg-background`.

Left column: small season posters. The active season is the large poster above or beside that column, large enough to read as the piece that flew in. Tapping a season poster, or scrolling that season into view on the right, selects it.

Right column: seasons in catalogue order. Each season header shows the season name and, when a season log exists, that log’s label (scope and rating when present). Under it, episode pills wrap. A whole-show log’s label sits under the large poster, not on every season.

Legend, under the episode list: not logged, watched with no rating, and a 0–10 ramp. The ramp mixes `foreground` into the empty pill from none at 0 to full at 10. The neutral watched pill is `bg-background` with no number. Empty pills match the group surface and show only the episode number.

## Motion

Measure the poster cell and the large-slot rect. Animate the poster’s position, scale, and a Y flip between those rects. The grid cell stays in place and does not show a second poster during the trip.

None of the transitions.dev snippets is a shared-element path. Do not use the modal scale-in or the page slide for this open. Keep `prefers-reduced-motion`: skip the trip and the flip.

On close, measure the cell again so a scrolled diary still receives the poster. Duration stays under 500ms for the trip. The flip and the move run together, not as two full waits.

## Data

No new endpoints.

- Seasons: `GET /api/tv/:id/seasons`
- Episodes: `GET /api/tv/:id/season/:n` for each season with episodes
- Diary: `GET /api/logs/me/by-tv/:id`

Match an episode log when `logScope` is `episode` and `seasonNumber` and `episodeNumber` match. Ignore season and show logs when coloring pills. Average uses stored rating tenths; display uses the existing diary rating formatter. Latest log for Quick Log is the newest `watchedAt` among that episode’s logs.

Load the season list when the dialog opens. Load episode lists for the open season first, then the rest. Pills for a season still loading are quiet bones the same size as the pills.

## Errors

- Seasons fail: the poster still arrives. The right side says the episodes could not be loaded and offers Try again.
- Diary logs fail: seasons and empty pills still render. A line says diary entries could not be loaded and offers Try again. Do not paint neutral or rated pills from a failed read.
- One season’s episodes fail: that season shows Try again. Other seasons stay.

## Non-goals

- Changing film diary tiles
- Coloring pills from `tv_watch` checkmarks
- Creating a diary log from an empty pill
- A new rating color palette beyond the foreground mix above

## Test plan

- Left click travels, flips, and opens the dialog. Right-click does not.
- Close returns the poster to the cell. Scroll the diary while open, then close, and the poster lands on the cell’s new position.
- Reduced motion opens and closes without a trip or a flip.
- An episode with no log is empty. An episode whose logs have no rating is neutral. Two rated logs average.
- A season log and a show log show as labels and do not change pill color.
- A logged pill opens Quick Log for the latest log of that episode. Saving a rating updates the pill and the legend number without closing the dialog.
- Season fetch failure and diary fetch failure show Try again and do not invent colors.
