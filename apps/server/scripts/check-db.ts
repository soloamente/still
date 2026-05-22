import { db } from "@still/db";
import { sql } from "drizzle-orm";

try {
	const rows = await db.execute(sql`select 1 as ok`);
	console.log("DATABASE_OK", rows);
} catch (err) {
	console.error("DATABASE_FAIL");
	if (err instanceof Error) {
		console.error(err.message.slice(0, 600));
		const cause = err.cause;
		if (cause instanceof Error)
			console.error("cause:", cause.message.slice(0, 600));
		else if (cause) console.error("cause:", String(cause).slice(0, 600));
	} else {
		console.error(String(err).slice(0, 600));
	}
	process.exit(2);
}
