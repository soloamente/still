/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
/**
 * Checks whether the running PreMiD extension supports a given `Presence` /
 * `iFrame` capability.
 *
 * Activities run across every extension version, so APIs added in newer
 * versions (e.g. `execInPage`, `onRequest`) may be missing on older installs,
 * where calling them directly would throw. This helper is bundled into the
 * activity, so it works regardless of the extension version — feature-detect
 * before calling:
 *
 * @example
 * if (supports(presence, 'onRequest')) {
 *   presence.onRequest({ url: '/api/now-playing' }, handleRequest)
 * }
 *
 * @param target The `Presence` or `iFrame` instance to check
 * @param feature Name of the method to check for
 * @returns `true` when the capability is available on this extension version
 */
export function supports<T extends object, K extends keyof T>(
  target: T,
  feature: K,
): boolean {
  return typeof target[feature] === 'function'
}
