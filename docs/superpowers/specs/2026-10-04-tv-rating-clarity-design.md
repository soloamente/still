# TV rating clarity

**Date:** 2026-10-04
**Status:** Approved
**Intent:** Flow change. Existing TV page, watched drawer, and Quick Log visuals stay.

## Problem

Episode scores roll up to a season average, and season scores roll up to a show average, but the show page never says so. A saved show score of 10 and a season average of 9.7 show up as if they were the same rating. The watched list and Edit log read the latest diary row, so an episode rated 10 can appear as the show’s 10/10.

## Rules

- A score saved on the show stays. The show score is the average of season scores only when the show itself was never rated.
- A score saved on a season stays. The season score is the average of its rated episodes only when that season was never rated.
- Means stay at one decimal. 9.7 is not rounded to 10.
- The average is calculated when the page is read. It is not written onto the diary row.
- Changing the slider keeps that score as yours. Later episode scores do not overwrite it.

## Surfaces

- **Show page**, top of Your progress: the official number, then “Your rating” or “Average of N seasons”. When your score differs, a quieter “Seasons average 9.7”.
- **Each season** (season rows and episode accordions): the same pattern with “Average of N episodes” and “Episodes average …”.
- **Watched list:** each patron’s show score from the same rules, labeled “Your rating” or “Average”. Not the latest episode’s raw rating.
- **Editor:** Edit on the show opens the show log. The slider is the saved score. “Seasons average 9.7” sits under the slider when that average exists and is not the slider value. Season and episode edits stay on that season or episode.

## Out of scope

- Rewriting stored logs to match the average.
- A new visual language for these controls.
