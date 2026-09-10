import { restoreSnapshot } from "./restore-snapshot.mjs";
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const literal = (value) => {
  if (value === null) return "NULL";
  if (typeof value === "string") return "'" + value.replaceAll("'", "''") + "'";
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
  )
    return String(value);
  throw new Error("UNSUPPORTED_SNAPSHOT_VALUE");
};
/** Produce a D1 import for a NEW empty database only. No DROP or overwrite path. */
export function restoreSql(snapshot) {
  restoreSnapshot(snapshot, ":memory:");
  const statements = ["PRAGMA defer_foreign_keys=ON;"];
  for (const item of snapshot.schema.filter((x) => x.type === "table" && x.sql))
    statements.push(item.sql + ";");
  for (const table of [...snapshot.tables].sort(
    (a, b) => (a.name === "sqlite_sequence") - (b.name === "sqlite_sequence"),
  )) {
    if (table.name === "sqlite_sequence")
      statements.push("DELETE FROM sqlite_sequence;");
    for (const row of table.rows)
      statements.push(
        `INSERT INTO ${quote(table.name)} (${Object.keys(row).map(quote).join(",")}) VALUES (${Object.values(row).map(literal).join(",")});`,
      );
  }
  for (const item of snapshot.schema.filter((x) => x.type !== "table" && x.sql))
    statements.push(item.sql + ";");
  for (const item of snapshot.schema.filter(
    (x) => x.type === "table" && /CREATE VIRTUAL TABLE/i.test(x.sql || ""),
  ))
    statements.push(
      `INSERT INTO ${quote(item.name)} (${quote(item.name)}) VALUES ('rebuild');`,
    );
  statements.push("PRAGMA defer_foreign_keys=OFF;");
  return statements.join("\n");
}
