import application from "../../../sense-companion-host/discord-application.json";

/** Discord application id from the host config. It is not a secret. */
export function readSenseDiscordClientId(): string | null {
	const clientId = application.clientId;
	return typeof clientId === "string" && /^\d{17,20}$/.test(clientId)
		? clientId
		: null;
}
