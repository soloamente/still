/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
import { getTimestamps } from './getTimestamps.js'

/**
 * Gets timestamps from an HTML media element (audio or video)
 * @param {HTMLMediaElement} media The media element to get timestamps from (works with both <audio> and <video> elements)
 * @returns {[number, number]} Array containing [startTimestamp, endTimestamp] as Unix timestamps in seconds
 */
export function getTimestampsFromMedia(
  media: HTMLMediaElement,
): [startTimestamp: number, endTimestamp: number] {
  //* Return early if media is not loaded or has no duration
  if (media.readyState === 0 || !Number.isFinite(media.duration))
    return [0, 0]

  return getTimestamps(media.currentTime, media.duration)
}
