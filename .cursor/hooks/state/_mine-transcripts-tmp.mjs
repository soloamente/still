import fs from "node:fs";
import readline from "node:readline";

const cutoff = new Date("2026-10-04T18:32:13.854Z").getTime();
const parent =
	"C:/Users/adgv/.cursor/projects/c-Users-adgv-Documents-Projects-still/agent-transcripts/26023be4-2ab1-497f-9360-1ca609776d2a/26023be4-2ab1-497f-9360-1ca609776d2a.jsonl";

function textOf(message) {
	const parts = message?.content ?? [];
	let text = "";
	for (const c of parts) {
		if (c?.type === "text" && typeof c.text === "string") text += c.text;
	}
	return text;
}

function parseTs(text) {
	const m = text.match(/<timestamp>([^<]+)<\/timestamp>/);
	if (!m) return null;
	const d = new Date(m[1]);
	return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function extractQuery(text) {
	const q = text.match(/<user_query>([\s\S]*?)<\/user_query>/);
	return (q ? q[1] : text).trim();
}

const rl = readline.createInterface({
	input: fs.createReadStream(parent),
	crlfDelay: Number.POSITIVE_INFINITY,
});

const out = [];
let n = 0;
for await (const line of rl) {
	n += 1;
	if (!line.startsWith('{"role":"user"')) continue;
	let o;
	try {
		o = JSON.parse(line);
	} catch {
		continue;
	}
	if (o.role !== "user") continue;
	const text = textOf(o.message);
	const ts = parseTs(text);
	if (ts != null && ts <= cutoff) continue;
	const body = extractQuery(text);
	if (!body) continue;
	out.push({
		n,
		ts: ts ? new Date(ts).toISOString() : null,
		len: body.length,
		body: body.slice(0, 4000),
	});
}

const dest =
	"C:/Users/adgv/Documents/Projects/still/.cursor/hooks/state/_mine-user-queries.json";
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log("user msgs after cutoff", out.length, "lines", n);
