import { stillApiOrigin } from "@/lib/still-api-origin";

export type ReviewAudioUploadResult = {
	audioUrl: string;
	audioDurationMs: number;
	audioMimeType: string;
};

/** Upload a voice clip for an existing review (multipart via web host proxy). */
export async function uploadReviewAudio(args: {
	reviewId: string;
	blob: Blob;
	durationMs: number;
	filename?: string;
}): Promise<ReviewAudioUploadResult> {
	const form = new FormData();
	form.append("file", args.blob, args.filename ?? "voice.webm");
	form.append("durationMs", String(args.durationMs));

	const res = await fetch(
		new URL(`/api/reviews/${args.reviewId}/audio`, stillApiOrigin()),
		{
			method: "POST",
			body: form,
			credentials: "include",
		},
	);

	if (!res.ok) {
		let msg = `Upload failed (${res.status})`;
		try {
			const body = (await res.json()) as {
				error?: string;
				code?: string;
				hint?: string;
			};
			if (body.code === "BLOB_UNCONFIGURED") {
				msg =
					body.hint ??
					"Add BLOB_READ_WRITE_TOKEN to the API server .env (Vercel Blob token).";
			} else if (body.code === "BLOB_ACCESS_MISMATCH" && body.hint) {
				msg = body.hint;
			} else if (body.error) msg = body.error;
		} catch {
			/* use default */
		}
		throw new Error(msg);
	}

	const data = (await res.json()) as Partial<ReviewAudioUploadResult>;
	if (!data.audioUrl) {
		throw new Error("Upload succeeded but no URL returned");
	}

	return {
		audioUrl: data.audioUrl,
		audioDurationMs: data.audioDurationMs ?? args.durationMs,
		audioMimeType: data.audioMimeType ?? args.blob.type ?? "audio/webm",
	};
}
