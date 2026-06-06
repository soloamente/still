/** Safe filename stem from a film/TV title for patron downloads. */
export function tmdbImageDownloadFilename(title: string, index: number) {
	const stem = title
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.toLowerCase();
	const base = stem.length > 0 ? stem : "sense-background";
	return `${base}-background-${index}.jpg`;
}

/**
 * Download a TMDb image at full resolution. Fetches as blob when CORS allows;
 * otherwise opens the URL in a new tab so the patron can save from the browser.
 */
export async function downloadTmdbImage(url: string, filename: string) {
	try {
		const response = await fetch(url, { mode: "cors", credentials: "omit" });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = blobUrl;
		anchor.download = filename;
		anchor.rel = "noopener";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(blobUrl);
	} catch {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}
