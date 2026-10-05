/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
import type { Root } from '../types.js'
import pLimit from 'p-limit'

const limit = pLimit(1)

// eslint-disable-next-line import/no-mutable-exports
export let metadata: {
  url: string
  data?: Root
} | null = null

export async function fetchMetadata(id: string): Promise<void> {
  await limit(async () => {
    if (metadata?.url === document.location.href)
      return

    metadata = { url: document.location.href }
    metadata.data = await (
      await fetch(
        `https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=${id}`,
      )
    ).json()
  })
}

export function clearMetadata(): void {
  metadata = null
}
