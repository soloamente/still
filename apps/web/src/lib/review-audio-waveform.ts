/** Default bar count for recorder spectrum rows. */
export const REVIEW_AUDIO_WAVEFORM_BAR_COUNT = 48;

/** Placeholder spectrum before the patron records (quiet, even bars). */
export function createPlaceholderWaveformPeaks(
	barCount = REVIEW_AUDIO_WAVEFORM_BAR_COUNT,
): number[] {
	return Array.from({ length: barCount }, () => 0.12);
}

/** Normalize analyser frequency bins into `barCount` peaks in the 0–1 range. */
export function sampleAnalyserPeaks(
	analyser: AnalyserNode,
	barCount: number,
): number[] {
	const bins = new Uint8Array(analyser.frequencyBinCount);
	analyser.getByteFrequencyData(bins);
	const bucketSize = Math.max(1, Math.floor(bins.length / barCount));
	const peaks: number[] = [];

	for (let i = 0; i < barCount; i++) {
		const start = i * bucketSize;
		const end = Math.min(bins.length, start + bucketSize);
		let sum = 0;
		for (let j = start; j < end; j++) {
			sum += bins[j] ?? 0;
		}
		const average = sum / Math.max(1, end - start);
		// Boost speech frequencies so quiet mics still read on the spectrum.
		peaks.push(Math.min(1, (average / 255) * 1.35 + 0.08));
	}

	return peaks;
}

/** Decode a recorded blob into normalized waveform peaks for playback scrubbing. */
export async function extractWaveformPeaksFromBlob(
	blob: Blob,
	barCount = REVIEW_AUDIO_WAVEFORM_BAR_COUNT,
): Promise<number[]> {
	const arrayBuffer = await blob.arrayBuffer();
	const audioContext = new AudioContext();

	try {
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		const channelData = audioBuffer.getChannelData(0);
		if (channelData.length === 0) {
			return createPlaceholderWaveformPeaks(barCount);
		}

		const samplesPerBar = Math.max(
			1,
			Math.floor(channelData.length / barCount),
		);
		const peaks: number[] = [];

		for (let i = 0; i < barCount; i++) {
			const start = i * samplesPerBar;
			const end = Math.min(channelData.length, start + samplesPerBar);
			let max = 0;
			for (let j = start; j < end; j++) {
				max = Math.max(max, Math.abs(channelData[j] ?? 0));
			}
			peaks.push(max);
		}

		const peakMax = Math.max(...peaks, 0.001);
		return peaks.map((peak) => Math.max(0.08, peak / peakMax));
	} finally {
		await audioContext.close();
	}
}
