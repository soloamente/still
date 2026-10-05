/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
import type { IncludedItem } from './types.js'
import { maxWatchFromPlayback } from '../../../../../src/presence/max-watch.ts'
import { ActivityType, Assets, getTimestampsFromMedia } from 'premid'
import {
  clearPageInfo,
  fetchPageInfo,
  getPageInfo,
} from './functions/fetchPageInfo.js'

enum ActivityAssets {
  Logo = 'https://cdn.rcd.gg/PreMiD/websites/H/HBO%20Max/assets/logo.jpeg',
}

const presence = new Presence({
  clientId: '1394513095367463043',
})

function findByAlternateId(id: string) {
  return getPageInfo()?.data?.included?.find((x: IncludedItem) => x.attributes?.alternateId === id)
}

function findById(id: string) {
  return getPageInfo()?.data?.included?.find((x: IncludedItem) => x.id === id)
}

function getCoverArt(item: ReturnType<typeof findByAlternateId>): string | undefined {
  if (!item?.relationships?.images?.data)
    return undefined

  const images = item.relationships.images.data
  const allImages = images
    .map(ref => findById(ref.id))
    .filter(Boolean)

  const boxart = allImages.find((img) => {
    const kind = (img?.attributes as any)?.kind as string | undefined
    return kind && (kind.includes('box') || kind.includes('tile') || kind.includes('poster'))
  })
  if (boxart?.attributes.src)
    return boxart.attributes.src

  const any = allImages.find(img => img?.attributes.src)
  return any?.attributes.src
}

function getAttrs(item: ReturnType<typeof findByAlternateId>) {
  return item?.attributes as any
}

function getDescription(item: ReturnType<typeof findByAlternateId>): string | undefined {
  const attrs = getAttrs(item)
  return attrs?.logLine ?? attrs?.description ?? attrs?.synopsis ?? undefined
}

function getTitleInfo(usePresenceName: boolean) {
  const pageInfo = getPageInfo()
  if (!pageInfo?.data)
    return null

  const segments = location.pathname.split('/')

  if (segments[1] === 'video') {
    const episodeItem = findByAlternateId(segments[3] ?? '')
    const showId = episodeItem?.relationships?.show?.data.id ?? ''
    const showItem = findByAlternateId(showId)

    if (!episodeItem || !showItem)
      return null

    const isMovie = episodeItem.attributes.videoType === 'MOVIE'
    const s = episodeItem.attributes.seasonNumber
    const e = episodeItem.attributes.episodeNumber

    return {
      name: usePresenceName ? showItem.attributes.name : 'Max',
      details: usePresenceName
        ? episodeItem.attributes.name
        : showItem.attributes.name,
      state: isMovie ? 'Movie' : `Season ${s}, Episode ${e}`,
      largeImageKey: getCoverArt(showItem),
      largeImageText: isMovie
        ? showItem.attributes.name
        : `S${s}:E${e} — ${episodeItem.attributes.name}`,
      isMovie,
      showTitle: showItem.attributes.name,
      season: isMovie ? null : s ?? null,
      episode: isMovie ? null : e ?? null,
      pageUrl: document.location.href.split('?')[0]!,
      showUrl: `https://play.hbomax.com/series/${showId}`,
    }
  }

  const browseItem = findByAlternateId(segments[2] ?? '')
  const desc = getDescription(browseItem)

  return {
    details: browseItem?.attributes.name,
    state: desc?.slice(0, 128),
    largeImageKey: getCoverArt(browseItem),
    largeImageText: browseItem?.attributes.name,
    isMovie: segments[1] === 'movie',
    showTitle: undefined,
    season: null,
    episode: null,
    pageUrl: document.location.href.split('?')[0]!,
    showUrl: undefined,
  }
}

presence.on('UpdateData', async () => {
  reportSenseMedia(null)
  const [
    usePresenceName,
    showCoverArt,
    showTimestamp,
    showBrowsingStatus,
    privacyMode,
  ] = await Promise.all([
    presence.getSetting<boolean>('usePresenceName'),
    presence.getSetting<boolean>('cover'),
    presence.getSetting<boolean>('timestamp'),
    presence.getSetting<boolean>('showBrowsingStatus'),
    presence.getSetting<boolean>('privacy'),
  ])

  const presenceData: PresenceData = {
    type: ActivityType.Watching,
    largeImageKey: ActivityAssets.Logo,
  }

  const segments = document.location.pathname.split('/')

  await fetchPageInfo(document.location.pathname)

  switch (segments[1]) {
    case 'show': {
      if (privacyMode) {
        presenceData.details = 'Watching a series'
        break
      }
      const info = getTitleInfo(false)
      presenceData.details = info?.details ?? 'Viewing a show:'
      presenceData.state = info?.state
      if (showCoverArt && info?.largeImageKey) {
        presenceData.largeImageKey = info.largeImageKey
        presenceData.largeImageText = info.largeImageText
      }
      if (info?.pageUrl)
        presenceData.buttons = [{ label: 'View Series', url: info.pageUrl }]
      break
    }

    case 'movie': {
      if (privacyMode) {
        presenceData.details = 'Watching a movie'
        break
      }
      const info = getTitleInfo(false)
      presenceData.details = info?.details ?? 'Viewing a movie:'
      presenceData.state = info?.state
      if (showCoverArt && info?.largeImageKey) {
        presenceData.largeImageKey = info.largeImageKey
        presenceData.largeImageText = info.largeImageText
      }
      if (info?.pageUrl)
        presenceData.buttons = [{ label: 'View Movie', url: info.pageUrl }]
      break
    }

    case 'video': {
      const video = document.querySelector('video')
      const info = getTitleInfo(usePresenceName && !privacyMode)

      if (!info || !video)
        break

      const watch = maxWatchFromPlayback({
        showTitle: info.showTitle,
        isMovie: info.isMovie,
        season: info.season,
        episode: info.episode,
      })
      if (watch) {
        reportSenseMedia({
          ...watch,
          positionSec: Math.floor(video.currentTime),
          durationSec: Number.isFinite(video.duration) ? Math.floor(video.duration) : null,
        })
      }

      if (!privacyMode) {
        presenceData.name = info.name
        presenceData.details = info.details
        presenceData.state = info.state
        if (showCoverArt && info.largeImageKey) {
          presenceData.largeImageKey = info.largeImageKey
          presenceData.largeImageText = info.largeImageText
        }
        if (info.isMovie) {
          presenceData.buttons = [{ label: 'Watch Movie', url: info.pageUrl }]
        }
        else {
          presenceData.buttons = info.showUrl
            ? [{ label: 'Watch Episode', url: info.pageUrl }, { label: 'View Series', url: info.showUrl }]
            : [{ label: 'Watch Episode', url: info.pageUrl }]
        }
      }
      else {
        presenceData.details = info.isMovie ? 'Watching a movie' : 'Watching a series'
      }

      presenceData.smallImageKey = video.paused ? Assets.Pause : Assets.Play
      presenceData.smallImageText = video.paused ? 'Paused' : 'Playing'

      if (showTimestamp && !video.paused && !privacyMode) {
        const [start, end] = getTimestampsFromMedia(video)
        presenceData.startTimestamp = start
        presenceData.endTimestamp = end
      }
      break
    }

    default: {
      clearPageInfo()

      if (!showBrowsingStatus || privacyMode)
        return presence.clearActivity()

      presenceData.details = 'Browsing Max...'
      presenceData.smallImageKey = Assets.Reading
      presenceData.smallImageText = 'Browsing'
      break
    }
  }

  if (presenceData.details)
    presence.setActivity(presenceData)
  else
    presence.clearActivity()
})
