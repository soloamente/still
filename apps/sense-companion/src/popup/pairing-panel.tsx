import { type FormEvent, useEffect, useState } from "react";

import {
	type CompanionStatus,
	linkCompanion,
	pairCompanion,
	pairErrorCopy,
	readCompanionStatus,
} from "../pairing/client";
import { SENSE_COMPANION_ORIGIN } from "../pairing/origin";
import { chromeCompanionTokenStore } from "../pairing/storage";

export function senseStatusTone(
	status: CompanionStatus | "checking",
): "checking" | "connected" | "disconnected" {
	switch (status) {
		case "checking":
			return "checking";
		case "paired":
			return "connected";
		case "not_paired":
		case "unreachable":
			return "disconnected";
		default: {
			const neverStatus: never = status;
			return neverStatus;
		}
	}
}

function senseStatusClass(status: CompanionStatus | "checking"): string {
	const tone = senseStatusTone(status);
	return tone === "checking" ? "status" : `status ${tone}`;
}

export function senseStatusCopy(status: CompanionStatus | "checking"): string {
	switch (status) {
		case "checking":
			return "Checking Sense…";
		case "paired":
			return "Paired with Sense.";
		case "not_paired":
			return "Not paired.";
		case "unreachable":
			return "Can't reach Sense.";
		default: {
			const neverStatus: never = status;
			return neverStatus;
		}
	}
}
type PairingPanelProps = {
	onStatus?: (status: CompanionStatus) => void;
	/** Popup shows the status as an icon, so this panel only keeps the pair form. */
	quiet?: boolean;
};

/** Pairing code from Settings → Profile. Discord does not need this. */
export function PairingPanel({ onStatus, quiet = false }: PairingPanelProps) {
	const [status, setStatus] = useState<CompanionStatus | "checking">(
		"checking",
	);
	const [code, setCode] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [messageTone, setMessageTone] = useState<"connected" | "disconnected">(
		"disconnected",
	);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await linkCompanion({ store: chromeCompanionTokenStore });
			const next = await readCompanionStatus({
				origin: SENSE_COMPANION_ORIGIN,
				store: chromeCompanionTokenStore,
			});
			if (cancelled) return;
			setStatus(next);
			onStatus?.(next);
		})().catch(() => {
			if (cancelled) return;
			setStatus("not_paired");
			onStatus?.("not_paired");
		});
		return () => {
			cancelled = true;
		};
	}, [onStatus]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;
		setSubmitting(true);
		setMessage(null);
		const result = await pairCompanion({
			origin: SENSE_COMPANION_ORIGIN,
			code,
			store: chromeCompanionTokenStore,
		});
		setSubmitting(false);
		if (result.ok) {
			setStatus("paired");
			onStatus?.("paired");
			setCode("");
			setMessageTone("connected");
			setMessage("Paired with Sense.");
			return;
		}
		setMessageTone("disconnected");
		if (result.error === "unreachable") {
			setStatus("unreachable");
			onStatus?.("unreachable");
			setMessage("Sense isn't running on this computer.");
			return;
		}
		setMessage(pairErrorCopy(result.error));
	}

	if (status === "checking" || status === "paired") {
		if (quiet) return null;
		return (
			<p className={senseStatusClass(status)}>{senseStatusCopy(status)}</p>
		);
	}

	return (
		<>
			{quiet ? null : (
				<p className={senseStatusClass(status)} role="status">
					{senseStatusCopy(status)}
				</p>
			)}
			<p className="hint">
				In Sense, open Settings → Profile and show a pairing code.
			</p>
			<form onSubmit={(event) => void handleSubmit(event)}>
				<label htmlFor="pairing-code">Pairing code</label>
				<input
					id="pairing-code"
					name="code"
					type="text"
					inputMode="text"
					autoComplete="off"
					autoCapitalize="characters"
					spellCheck={false}
					required
					value={code}
					disabled={submitting}
					onChange={(event) => setCode(event.target.value)}
				/>
				<button type="submit" disabled={submitting}>
					{submitting ? "Pairing…" : "Pair"}
				</button>
			</form>
			{message ? (
				<p className={`message ${messageTone}`} role="status">
					{message}
				</p>
			) : null}
		</>
	);
}
