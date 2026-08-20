import fs from "fs";
import path from "path";

const root =
	"C:/Users/adgv/.cursor/projects/c-Users-adgv-Documents-Projects-still/agent-transcripts";

const parents = [
	"20730077-1ffd-404e-81e6-f4669efe5904",
	"61425fe9-13de-42ae-b555-e2626e866422",
	"390c2d99-9307-42cc-a615-6f13104487bd",
	"01b70e76-8f4b-4c31-a4c5-3d64412916e9",
	"514371d9-7dca-4768-95dc-844debb830c9",
	"b06f3640-2d4d-44ee-906d-855adf819c11",
	"269e54b7-6f8d-4fc8-b318-741129b77b58",
	"b19ecbc7-8141-4a83-b8bd-309696d91d69",
	"0120dcb1-41eb-46ad-987c-5dbc76cc5955",
	"baed870e-a34b-45d2-89fe-9d5d94a31d77",
	"66857fec-cc3f-4ce1-81c8-d8f1343892cf",
	"9d732b07-1e8b-49d8-a5ca-710c95176e21",
];

function extractText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((c) => {
				if (typeof c === "string") return c;
				if (c && typeof c === "object") {
					if (c.type === "text") return c.text || "";
					if (typeof c.text === "string") return c.text;
				}
				return "";
			})
			.join("\n");
	}
	return "";
}

function getUserText(j) {
	if (j.role === "user" && j.message) {
		return extractText(j.message.content);
	}
	if (j.message?.role === "user") {
		return extractText(j.message.content);
	}
	return "";
}

const out = [];
for (const id of parents) {
	const p = path.join(root, id, `${id}.jsonl`);
	if (!fs.existsSync(p)) continue;
	const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean);
	const users = [];
	for (const line of lines) {
		let j;
		try {
			j = JSON.parse(line);
		} catch {
			continue;
		}
		const text = getUserText(j);
		if (!text.trim()) continue;
		// strip system wrappers noise when possible
		const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
		const body = (m ? m[1] : text).trim();
		// redact secrets-ish
		const redacted = body
			.replace(/ORIGINKIT_API_KEY=\S+/g, "ORIGINKIT_API_KEY=[REDACTED]")
			.replace(/cmp_live_\S+/g, "[REDACTED]")
			.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
		if (redacted.length < 8) continue;
		if (redacted.includes("continual-learning")) continue;
		if (redacted.includes("Briefly inform the user")) continue;
		if (redacted.includes("mcp_meta_tools")) continue;
		users.push(redacted.slice(0, 2200));
	}
	out.push({ id, count: users.length, users });
}

fs.writeFileSync(
	"C:/Users/adgv/Documents/Projects/still/.cursor/hooks/state/_mine-out.json",
	JSON.stringify(out, null, 2),
);
console.log(out.map((o) => `${o.id}: ${o.count} user msgs`).join("\n"));
