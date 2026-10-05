/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
/**
 * Converts current media time and duration into Unix timestamps
 * @param {number} elementTime Current playback position in seconds
 * @param {number} elementDuration Total duration of the media in seconds
 * @returns {[number, number]} Array containing [startTimestamp, endTimestamp] as Unix timestamps in seconds
 */
export function getTimestamps(
  elementTime: number,
  elementDuration: number,
): [startTimestamp: number, endTimestamp: number] {
  const startTime = (Date.now() / 1000) - elementTime
  const endTime = startTime + elementDuration
  return [Math.floor(startTime), Math.floor(endTime)]
}
