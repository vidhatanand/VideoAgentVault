import { DatabaseSync } from "node:sqlite";
import { chmodSync, openSync, closeSync } from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
const digest = (rows) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        rows
          .map((x) =>
            JSON.stringify(
              Object.fromEntries(
                Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
              ),
            ),
          )
          .sort(),
      ),
    )
    .digest("hex");

/** Restore a logical application snapshot; never connects to production. */
export function restoreSnapshot(snapshot, filename) {
  if (filename !== ":memory:") closeSync(openSync(filename, "wx", 0o600));
  const db = new DatabaseSync(filename);
  if (filename !== ":memory:") chmodSync(filename, 0o600);
  try {
    db.exec("PRAGMA foreign_keys=OFF; BEGIN;");
    for (const x of snapshot.schema.filter((x) => x.type === "table" && x.sql))
      db.exec(x.sql);
    const counts = {},
      hashes = {};
    for (const table of [...snapshot.tables].sort(
      (a, b) => (a.name === "sqlite_sequence") - (b.name === "sqlite_sequence"),
    )) {
      if (table.name === "sqlite_sequence")
        db.exec("DELETE FROM sqlite_sequence");
      for (const row of table.rows) {
        const columns = Object.keys(row),
          values = Object.values(row);
        assert.ok(
          values.every(
            (x) =>
              x === null ||
              typeof x === "string" ||
              (typeof x === "number" && Number.isSafeInteger(x)) ||
              (typeof x === "number" && !Number.isInteger(x)),
          ),
          "Unsupported/lossy snapshot value",
        );
        db.prepare(
          `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
        ).run(...values);
      }
      counts[table.name] = db
        .prepare(`SELECT COUNT(*) n FROM ${quote(table.name)}`)
        .get().n;
      assert.equal(counts[table.name], table.rows.length);
      const columns = Object.keys(table.rows[0] || {});
      const restored = columns.length
        ? db
            .prepare(
              `SELECT ${columns.map(quote).join(",")} FROM ${quote(table.name)}`,
            )
            .all()
        : [];
      assert.equal(
        digest(restored),
        digest(table.rows),
        "Restored row values differ",
      );
      hashes[table.name] = digest(restored);
    }
    for (const x of snapshot.schema.filter((x) => x.type !== "table" && x.sql))
      db.exec(x.sql);
    for (const x of snapshot.schema.filter(
      (x) => x.type === "table" && /CREATE VIRTUAL TABLE/i.test(x.sql || ""),
    )) {
      assert.ok(/USING fts5/i.test(x.sql), "Unsupported virtual table");
      db.prepare(
        `INSERT INTO ${quote(x.name)} (${quote(x.name)}) VALUES ('rebuild')`,
      ).run();
      db.prepare(
        `INSERT INTO ${quote(x.name)} (${quote(x.name)},rank) VALUES ('integrity-check',1)`,
      ).run();
    }
    db.exec("COMMIT; PRAGMA foreign_keys=ON;");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    return {
      tableCounts: counts,
      tableHashes: hashes,
      foreignKeys: true,
      integrity: true,
      ftsRebuilt: true,
      scope:
        "Local logical restore; not account-level Time Travel or deleted-media recovery",
    };
  } finally {
    db.close();
  }
}
