/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Vendored from https://github.com/PreMiD/Activities
 * commit e4c0de9c04a3d310877343bdc05b04bdd7b42603.
 */
import { parseAppleTvEpisode } from '../../../../../src/presence/apple-episode.ts'
import { ActivityType, Assets, getTimestampsFromMedia } from 'premid'

const presence = new Presence({
  clientId: '835157562432290836',
})
const startTimestamp = Math.floor(Date.now() / 1000)

presence.on('UpdateData', async () => {
  reportSenseMedia(null)
  const presenceData: PresenceData = {
    type: ActivityType.Watching,
    largeImageKey: 'https://cdn.rcd.gg/PreMiD/websites/A/Apple%20TV%2B/assets/logo.png',
    details: 'Browsing...',
    smallImageKey: Assets.Search,
    startTimestamp,
  }
  const [showButton, showCover, useActivityName] = await Promise.all([
    presence.getSetting<boolean>('showButton'),
    presence.getSetting<boolean>('showCover'),
    presence.getSetting<boolean>('useActivityName'),
  ])
  const video = document.querySelector('video')

  if (
    video
    && document.querySelector('.video-player__tabs')
  ) {
    const title = document
      .querySelector('.video-metadata .title')
      ?.textContent
      ?.trim()
    const subtitle = document
      .querySelector('.video-metadata .subtitle-text')
      ?.textContent
      ?.trim()
    const thumbnail = navigator.mediaSession.metadata?.artwork

    // A missing poster must not hide the title. Upstream returned here and
    // dropped the whole update until artwork showed up.
    if (title) {
      const episodeMark = parseAppleTvEpisode(subtitle)
      reportSenseMedia({
        provider: 'apple',
        kind: episodeMark.season != null || episodeMark.episode != null ? 'episode' : 'movie',
        title,
        season: episodeMark.season,
        episode: episodeMark.episode,
        positionSec: Math.floor(video.currentTime),
        durationSec: Number.isFinite(video.duration) ? Math.floor(video.duration) : null,
      })
    }

    if (useActivityName)
      presenceData.name = title

    if (subtitle) {
      const [seasonNumber, episodeNumber, episodeTitle] = subtitle
        .split(/, | · /)
        .flatMap(x => Number.parseInt(x.replace(/^./, '')) || x)

      presenceData.details = useActivityName ? (episodeTitle as string) : title
      presenceData.state = useActivityName
        ? `Season ${seasonNumber}, Episode ${episodeNumber}`
        : `S${seasonNumber}:E${episodeNumber} ${episodeTitle}`
    }
    else {
      presenceData.details = title
      presenceData.state = document
        .querySelector(
          '.metadata-genre',
        )
        ?.textContent
        ?.trim()
    }

    if (showCover && thumbnail) {
      presenceData.largeImageKey = thumbnail[thumbnail.length - 1]?.src
    }

    if (!video.paused) {
      [presenceData.startTimestamp, presenceData.endTimestamp] = getTimestampsFromMedia(video)
      delete presenceData.smallImageKey
    }
    else {
      presenceData.smallImageKey = Assets.Pause
    }

    presenceData.buttons = [
      {
        label: `Watch ${subtitle ? 'Episode' : 'Show'}`,
        url: location.href,
      },
    ]
  }

  if (!showButton)
    delete presenceData.buttons

  presence.setActivity(presenceData)
})
