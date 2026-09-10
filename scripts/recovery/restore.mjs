import { parseArgs } from "node:util";
import { readBundle } from "./bundle.mjs";
import { restoreSnapshot } from "./restore-snapshot.mjs";
const { values: v } = parseArgs({
  options: { input: { type: "string" }, output: { type: "string" } },
});
if (!v.input || !v.output)
  throw new Error(
    "Provide --input PRIVATE_DIRECTORY --output NEW_SQLITE_FILE.",
  );
const { snapshot } = await readBundle(v.input);
const result = restoreSnapshot(snapshot, v.output);
console.log(
  JSON.stringify({
    restored: true,
    tables: Object.keys(result.tableCounts).length,
    integrity: result.integrity,
    foreignKeys: result.foreignKeys,
    ftsRebuilt: result.ftsRebuilt,
  }),
);
