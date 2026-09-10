import { parseArgs } from "node:util";
import { cloudflare } from "../cloudflare.mjs";
import {
  schemaQuery,
  applicationColumnsQuery,
  snapshotQuery,
  decodeSnapshot,
} from "./snapshot-query.mjs";
import { writeBundle } from "./bundle.mjs";
const { values: v } = parseArgs({
  options: {
    account: { type: "string" },
    database: { type: "string" },
    output: { type: "string" },
  },
});
if (!/^[a-f0-9-]{36}$/i.test(v.database || "") || !v.output)
  throw new Error(
    "Provide --account, --database ID and --output PRIVATE_DIRECTORY.",
  );
const cf = cloudflare(v.account, process.env.CLOUDFLARE_API_TOKEN);
const query = async (sql) => {
  const out = await cf(`/d1/database/${v.database}/query`, {
    method: "POST",
    body: { sql },
  });
  if (!out.length || out.some((x) => !x.success))
    throw new Error("INCOMPLETE_DATABASE_READ");
  return out.map((x) => x.results);
};
const active = (
  await query("SELECT count(*) AS n FROM jobs WHERE finished_at IS NULL")
)[0][0].n;
if (active)
  throw new Error(
    "RECOVERY_REQUIRES_QUIESCENT_PROCESSING: finish or explicitly cancel active jobs before capture.",
  );
const [tables, schema] = await query("PRAGMA table_list;" + schemaQuery + ";");
const [columns] = await query(applicationColumnsQuery(tables));
const plan = snapshotQuery(tables, schema, columns);
const [rows] = await query(plan.sql);
const snapshot = decodeSnapshot(plan, rows);
if (
  snapshot.tables
    .find((t) => t.name === "jobs")
    ?.rows.some((j) => j.finished_at === null)
)
  throw new Error("PROCESSING_STARTED_DURING_CAPTURE");
const manifest = await writeBundle(v.output, snapshot, {
  databaseId: v.database,
  scope:
    "Logical database only. R2, Vectorize and persistent encryption secrets require separate recovery.",
});
console.log(
  JSON.stringify({
    captured: true,
    sha256: manifest.snapshotSha256,
    tables: Object.keys(manifest.verification.tableCounts).length,
    integrity: manifest.verification.integrity,
    foreignKeys: manifest.verification.foreignKeys,
  }),
);
