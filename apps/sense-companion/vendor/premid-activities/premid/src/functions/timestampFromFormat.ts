/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
/**
 * Converts a time string into seconds
 * @param {string} timestamp Time in format HH:MM:SS, MM:SS, or SS
 * @returns {number} Time in seconds, or 0 if format is invalid
 */
export function timestampFromFormat(timestamp: string): number {
  //* Handle invalid input
  if (!timestamp || typeof timestamp !== 'string')
    return 0

  //* Check if format matches expected pattern
  if (!/^\d+(?::\d{1,2}(?::\d{1,2})?)?$/.test(timestamp))
    return 0

  //* Split the timestamp into parts and pad from the left with zeros
  const parts = timestamp.split(':').map(str => Number.parseInt(str, 10))
  while (parts.length < 3) parts.unshift(0)

  const [hours, minutes, seconds] = parts as [number, number, number]

  //* Validate ranges
  if (minutes >= 60 || seconds >= 60)
    return 0

  //* Convert everything to seconds
  return (hours * 3600) + (minutes * 60) + seconds
}
