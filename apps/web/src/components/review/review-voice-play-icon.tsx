import { cn } from "@still/ui/lib/utils";

/** Sense voice review play glyph — optically centered rounded triangle. */
export function ReviewVoicePlayIcon({ className }: { className?: string }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative — parent control exposes aria-label
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 12 12"
			className={cn("size-3 shrink-0 translate-x-px", className)}
			aria-hidden
		>
			<path
				d="M1.5 2.31061C1.5 0.943037 2.99801 0.103919 4.16406 0.818427L10.1855 4.50788C11.2997 5.19065 11.2997 6.80949 10.1855 7.49226L4.16406 11.1817C2.99802 11.8962 1.5 11.0571 1.5 9.68952V2.31061Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Sense voice review pause glyph — paired rounded bars. */
export function ReviewVoicePauseIcon({ className }: { className?: string }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative — parent control exposes aria-label
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 12 12"
			className={cn("size-3 shrink-0", className)}
			aria-hidden
		>
			<path
				d="M2.25 11C1.2835 11 0.5 10.2165 0.5 9.25L0.5 2.75C0.5 1.7835 1.2835 1 2.25 1L3.25 1C4.2165 1 5 1.7835 5 2.75L5 9.25C5 10.2165 4.2165 11 3.25 11H2.25Z"
				fill="currentColor"
			/>
			<path
				d="M7 9.25C7 10.2165 7.7835 11 8.75 11H9.75C10.7165 11 11.5 10.2165 11.5 9.25V2.75C11.5 1.7835 10.7165 1 9.75 1L8.75 1C7.7835 1 7 1.7835 7 2.75L7 9.25Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Sense voice review record glyph — ring + filled dot. */
export function ReviewVoiceRecordIcon({ className }: { className?: string }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative — button label names the action
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 18 18"
			className={cn("size-4 shrink-0", className)}
			aria-hidden
		>
			<path
				d="M9,1C4.589,1,1,4.589,1,9s3.589,8,8,8,8-3.589,8-8S13.411,1,9,1Zm0,14.5c-3.584,0-6.5-2.916-6.5-6.5S5.416,2.5,9,2.5s6.5,2.916,6.5,6.5-2.916,6.5-6.5,6.5Z"
				fill="currentColor"
			/>
			<circle cx="9" cy="9" r="5" fill="currentColor" />
		</svg>
	);
}

/** Sense voice review stop glyph — rounded square. */
export function ReviewVoiceStopIcon({ className }: { className?: string }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative — button label names the action
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 18 18"
			className={cn("size-4 shrink-0", className)}
			aria-hidden
		>
			<rect
				x="2"
				y="2"
				width="14"
				height="14"
				rx="2.75"
				ry="2.75"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Sense voice review re-record glyph — circular retry arrow. */
export function ReviewVoiceRetryIcon({ className }: { className?: string }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative — button label names the action
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 12 12"
			className={cn("size-3 shrink-0", className)}
			aria-hidden
		>
			<path
				d="M1.50014 6C1.50014 3.51521 3.51535 1.5 6.00014 1.5C7.77492 1.5 9.31212 2.52848 10.0451 4.02441C10.2275 4.39601 10.6762 4.54935 11.048 4.36719C11.4199 4.18497 11.5738 3.73617 11.3917 3.36426C10.4167 1.37419 8.36936 0 6.00014 0C2.68693 0 0.000141144 2.68679 0.000141144 6C0.000141144 9.31321 2.68693 12 6.00014 12C8.67562 12 10.9394 10.2492 11.714 7.83301C11.8405 7.43857 11.6231 7.01609 11.2287 6.88965C10.8344 6.76352 10.4127 6.98079 10.2863 7.375C9.70485 9.18872 8.00461 10.5 6.00014 10.5C3.51535 10.5 1.50014 8.48479 1.50014 6Z"
				fill="currentColor"
			/>
			<path
				d="M11.0371 0.556715C10.7569 0.440673 10.4342 0.505322 10.2197 0.719801L7.71973 3.2198C7.50525 3.43428 7.4406 3.75695 7.55664 4.03718C7.67273 4.31744 7.94665 4.50007 8.25 4.50007H10.75C11.1642 4.50007 11.5 4.16429 11.5 3.75007V1.25007C11.5 0.946728 11.3174 0.672801 11.0371 0.556715Z"
				fill="currentColor"
			/>
		</svg>
	);
}
