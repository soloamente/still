/**
 * Tiny cuid-ish id generator. We use it for all string PKs so we don't
 * have to pull in a dependency. Returns 24-char lowercase alphanumeric
 * ids that are URL-safe and sort by time (prefix is base36 timestamp).
 */
export function makeId(prefix?: string) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  const id = `${ts}${rand}`;
  return prefix ? `${prefix}_${id}` : id;
}
