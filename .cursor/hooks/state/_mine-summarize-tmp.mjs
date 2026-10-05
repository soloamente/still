import fs from "node:fs";
import readline from "node:readline";

const parent =
	"C:/Users/adgv/.cursor/projects/c-Users-adgv-Documents-Projects-still/agent-transcripts/26023be4-2ab1-497f-9360-1ca609776d2a/26023be4-2ab1-497f-9360-1ca609776d2a.jsonl";
const start = 3533;
const end = 3596;
const rl = readline.createInterface({
	input: fs.createReadStream(parent),
	crlfDelay: Number.POSITIVE_INFINITY,
});

function textOf(message) {
	const parts = message?.content ?? [];
	let text = "";
	for (const c of parts) {
		if (typeof c === "string") text += c;
		else if (c?.type === "text" && typeof c.text === "string") text += c.text;
	}
	return text;
}

let n = 0;
const chunks = [];
for await (const line of rl) {
	n += 1;
	if (n < start || n > end) continue;
	if (!line.startsWith("{")) continue;
	let o;
	try {
		o = JSON.parse(line);
	} catch {
		continue;
	}
	const role = o.role || "?";
	if (role !== "assistant") continue;
	const text = textOf(o.message || o);
	if (!text.trim()) continue;
	chunks.push(
		`\n##### ${n} assistant len ${text.length} #####\n${text.slice(0, 3500)}`,
	);
}

const dest =
	"C:/Users/adgv/Documents/Projects/still/.cursor/hooks/state/_mine-summary.txt";
fs.writeFileSync(dest, chunks.join("\n"));
console.log("chunks", chunks.length, "bytes", chunks.join("\n").length);
