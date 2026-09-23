/**
 * Local Neon HTTP proxy for offline development.
 *
 * `@still/db` always builds its runtime client with `@neondatabase/serverless`
 * `neon()` (HTTP `/sql` transport). That transport speaks to a Neon endpoint,
 * not to a plain Postgres port, so a local Postgres cannot serve it directly.
 *
 * This tiny server implements the Neon "SQL over HTTP" contract and forwards
 * queries to a local Postgres over the normal `pg` TCP driver. Pair it with
 * `scripts/dev/neon-local-preload.ts`, which sets `neonConfig.fetchEndpoint`
 * so the driver posts here.
 *
 * It is dev-only glue — not used on Vercel or Cloudflare Workers.
 */
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.NEON_HTTP_PROXY_PORT ?? 4444);
const DATABASE_URL =
	process.env.NEON_LOCAL_DATABASE_URL ??
	process.env.DATABASE_URL ??
	"postgres://postgres:postgres@localhost:5432/still";

// The Neon HTTP client always requests raw text output (Neon-Raw-Text-Output)
// and array rows (Neon-Array-Mode). It then applies its own pg type parsers on
// the client, so the proxy must return UNPARSED text values. Force `pg` to hand
// back the raw string for every OID by overriding the type parser to identity.
const identityTypes = { getTypeParser: () => (value) => value };

const pool = new pg.Pool({
	connectionString: DATABASE_URL,
	max: 10,
});

/** Shape one `pg` result into the JSON body the Neon HTTP client expects. */
function serializeResult(result) {
	return {
		command: result.command,
		rowCount: result.rowCount,
		rowAsArray: true,
		fields: (result.fields ?? []).map((f) => ({
			name: f.name,
			dataTypeID: f.dataTypeID,
			tableID: f.tableID,
			columnID: f.columnID,
			dataTypeSize: f.dataTypeSize,
			dataTypeModifier: f.dataTypeModifier,
			format: f.format,
		})),
		// rows are arrays of raw text (rowMode array + identity parsers above).
		rows: result.rows,
	};
}

/** Copy the Postgres error fields the Neon client surfaces as NeonDbError. */
function serializeError(err) {
	return {
		message: err.message,
		code: err.code,
		severity: err.severity,
		detail: err.detail,
		hint: err.hint,
		position: err.position,
		internalPosition: err.internalPosition,
		internalQuery: err.internalQuery,
		where: err.where,
		schema: err.schema,
		table: err.table,
		column: err.column,
		dataType: err.dataType,
		constraint: err.constraint,
		file: err.file,
		line: err.line,
		routine: err.routine,
	};
}

async function runSingle(client, body) {
	const result = await client.query({
		text: body.query,
		values: body.params ?? [],
		rowMode: "array",
		types: identityTypes,
	});
	return serializeResult(result);
}

function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
			} catch (err) {
				reject(err);
			}
		});
		req.on("error", reject);
	});
}

const server = http.createServer(async (req, res) => {
	if (req.method !== "POST") {
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ ok: true, proxy: "neon-http-local" }));
		return;
	}

	let body;
	try {
		body = await readJsonBody(req);
	} catch {
		res.writeHead(400, { "content-type": "application/json" });
		res.end(JSON.stringify({ message: "Invalid JSON body" }));
		return;
	}

	const client = await pool.connect();
	try {
		if (Array.isArray(body.queries)) {
			// Batch = transaction. Isolation level is advisory here; local dev
			// does not need the exact serializable semantics Neon enforces.
			const results = [];
			await client.query("BEGIN");
			try {
				for (const q of body.queries) {
					results.push(await runSingle(client, q));
				}
				await client.query("COMMIT");
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			}
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ results }));
			return;
		}

		const single = await runSingle(client, body);
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify(single));
	} catch (err) {
		res.writeHead(400, { "content-type": "application/json" });
		res.end(JSON.stringify(serializeError(err)));
	} finally {
		client.release();
	}
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(
		`[neon-http-proxy] listening on http://127.0.0.1:${PORT} -> ${DATABASE_URL.replace(/:\/\/[^@]*@/, "://<redacted>@")}`,
	);
});
