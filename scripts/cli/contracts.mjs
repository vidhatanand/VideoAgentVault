import fs from "node:fs/promises";
import {
  operationCatalogue,
  CONTRACT_VERSION,
  PROTOCOL_VERSIONS,
} from "../../src/contracts/catalogue.js";
import { RESPONSE_SCHEMAS } from "../../src/contracts/responses/index.js";
const paid = new Set([
  "processing_start",
  "processing_reuse",
  "batch_start",
  "processing_plan_execute",
]);
const operations = operationCatalogue().map((op) => ({
  ...op,
  responseSchema: RESPONSE_SCHEMAS[op.name],
  paid: paid.has(op.name),
  path: `/api/tenants/{tenantId}/operations/${op.name}`,
}));
if (operations.some((op) => !op.responseSchema))
  throw new Error("MISSING_OPERATION_RESPONSE_SCHEMA");
const content =
  JSON.stringify(
    {
      contractVersion: CONTRACT_VERSION,
      protocolVersions: PROTOCOL_VERSIONS,
      operations,
    },
    null,
    2,
  ) + "\n";
const file = "packages/cli/contracts.json";
if (process.argv.includes("--check")) {
  if ((await fs.readFile(file, "utf8")) !== content)
    throw new Error("CLI_CONTRACT_DRIFT");
} else await fs.writeFile(file, content);
console.log(
  `Verified ${operations.length} standalone CLI operation contracts.`,
);
