import assert from "node:assert/strict";
const quote = (s) => '"' + s.replaceAll('"', '""') + '"',
  literal = (s) => "'" + s.replaceAll("'", "''") + "'";
export const schemaQuery =
  "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type,name";
export const columnsQuery =
  "SELECT m.name AS table_name,p.name AS column_name,p.hidden FROM sqlite_schema m JOIN pragma_table_xinfo(m.name) p WHERE m.type='table' ORDER BY m.name,p.cid";
const applicationTables = (list) =>
  list
    .filter(
      (t) =>
        t.schema === "main" &&
        t.type === "table" &&
        !t.name.startsWith("_cf_") &&
        (!t.name.startsWith("sqlite_") || t.name === "sqlite_sequence"),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
// Enumerate an explicit application allowlist without compound SELECT terms.
export function applicationColumnsQuery(tableList) {
  return `SELECT names.value AS table_name,p.name AS column_name,p.hidden FROM json_each(${literal(JSON.stringify(applicationTables(tableList).map((t) => t.name)))}) names JOIN pragma_table_xinfo(names.value) p;`;
}
/** Compile a single read statement, preserving one consistent SQLite read snapshot. */
export function snapshotQuery(tableList, rawSchema, columns) {
  const tables = applicationTables(tableList);
  const virtual = tableList.filter(
    (t) => t.schema === "main" && t.type === "virtual",
  );
  for (const t of virtual)
    assert.match(
      rawSchema.find((s) => s.name === t.name)?.sql || "",
      /USING fts5\b/i,
      "Only FTS5 virtual tables are supported",
    );
  const views = tableList.filter(
    (t) =>
      t.schema === "main" &&
      t.type === "view" &&
      !t.name.startsWith("_cf_") &&
      !t.name.startsWith("sqlite_"),
  );
  const names = new Set([...tables, ...virtual, ...views].map((t) => t.name));
  const schema = rawSchema.filter(
    (s) => s.name !== "sqlite_sequence" && names.has(s.tbl_name),
  );
  const cases = [
    `WHEN '__schema__' THEN (SELECT json_group_array(json_object('type',type,'name',name,'tbl_name',tbl_name,'sql',sql)) FROM (${schemaQuery}))`,
  ];
  for (const table of tables) {
    const fields = columns
      .filter((c) => c.table_name === table.name && c.hidden === 0)
      .map((c) => c.column_name);
    assert.ok(fields.length, "Missing table columns");
    if (!table.wr) {
      assert.ok(
        !fields.some((f) =>
          ["rowid", "_rowid_", "oid"].includes(f.toLowerCase()),
        ),
        "Declared rowid alias needs an explicit recovery mapping",
      );
      fields.unshift("rowid");
    }
    cases.push(
      `WHEN ${literal(table.name)} THEN (SELECT json_group_array(json_object(${fields.map((f) => literal(f) + "," + quote(f)).join(",")})) FROM ${quote(table.name)})`,
    );
  }
  return {
    sql: `SELECT catalog.value AS name,CASE catalog.value ${cases.join("\n")} END AS payload FROM json_each(${literal(JSON.stringify(["__schema__", ...tables.map((t) => t.name)]))}) catalog;`,
    schema,
    rawSchema,
    tableNames: tables.map((t) => t.name),
  };
}
export function decodeSnapshot(plan, rows) {
  const raw = rows.find((r) => r.name === "__schema__");
  assert.ok(raw, "Schema receipt missing");
  assert.deepEqual(
    JSON.parse(raw.payload),
    plan.rawSchema,
    "Schema changed during snapshot preparation",
  );
  assert.equal(
    rows.length,
    plan.tableNames.length + 1,
    "Incomplete snapshot response",
  );
  return {
    schema: plan.schema,
    tables: plan.tableNames.map((name) => {
      const r = rows.find((r) => r.name === name);
      assert.ok(r, "Missing table snapshot");
      return { name, rows: JSON.parse(r.payload) };
    }),
    capturedAt: new Date().toISOString(),
    method: "single-read-statement-application-snapshot",
  };
}
