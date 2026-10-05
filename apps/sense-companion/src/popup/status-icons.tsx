type StatusIconProps = {
	tone: "checking" | "connected" | "disconnected";
	label: string;
	icon: "discord" | "link";
};

/** Green when the connection is up, red when it is not. The name stays on the icon. */
export function StatusIcon({ tone, label, icon }: StatusIconProps) {
	return (
		<span className={`status-icon ${tone}`} role="img" aria-label={label}>
			{icon === "discord" ? <DiscordMark /> : <LinkMark />}
		</span>
	);
}

function DiscordMark() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="currentColor"
				d="M19.27 5.33A17.4 17.4 0 0 0 15.09 4l-.18.36a16.1 16.1 0 0 1 4.02 1.26 16.5 16.5 0 0 0-13.86 0A16.2 16.2 0 0 1 9.1 4.36L8.91 4a17.4 17.4 0 0 0-4.18 1.33C2.2 9.05 1.4 12.68 1.8 16.26a17.6 17.6 0 0 0 5.32 2.69l.65-1.06a11.5 11.5 0 0 1-1.72-.83l.43-.33a12.6 12.6 0 0 0 10.96 0l.43.33c-.55.33-1.12.61-1.72.83l.65 1.06a17.6 17.6 0 0 0 5.32-2.69c.48-4.16-.8-7.75-3.15-10.93M8.7 14.3c-.99 0-1.8-.92-1.8-2.05s.79-2.05 1.8-2.05 1.82.92 1.82 2.05-.81 2.05-1.82 2.05m6.6 0c-.99 0-1.8-.92-1.8-2.05s.79-2.05 1.8-2.05 1.82.92 1.82 2.05-.81 2.05-1.82 2.05"
			/>
		</svg>
	);
}

function LinkMark() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M10 13a5 5 0 0 0 7.54.54l2.92-2.92a5 5 0 0 0-7.07-7.07l-1.67 1.67M14 11a5 5 0 0 0-7.54-.54l-2.92 2.92a5 5 0 0 0 7.07 7.07l1.67-1.67"
			/>
		</svg>
	);
}
