import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { CliError } from "../errors/index.js";
import { atomicJSON, configRoot } from "../config/profile.js";
import { authorizePaid } from "./authorize.js";
export async function invoke(
  client: any,
  workspace: string,
  op: any,
  args: any,
  flags: any,
) {
  if (op.paid) await authorizePaid(client, workspace, op, args, flags);
  if (op.annotations.readOnlyHint)
    return client.call(workspace, op.name, args, true);
  if (flags["request-key"]) args.requestKey = flags["request-key"];
  const digest = createHash("sha256")
    .update(
      JSON.stringify({ origin: client.origin, workspace, name: op.name, args }),
    )
    .digest("hex");
  const file = path.join(configRoot(), "requests", digest + ".json");
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  let lock;
  try {
    lock = await fs.open(file + ".lock", "wx", 0o600);
  } catch {
    throw new CliError(
      "REQUEST_LOCKED",
      "An identical request is running. Reconcile the saved intent after a crash before removing its lock.",
      5,
    );
  }
  try {
    let previous;
    try {
      previous = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const hasKey = !!op.inputSchema.properties.requestKey;
    if (previous && !hasKey && previous.state === "intent")
      throw new CliError(
        "MUTATION_OUTCOME_UNKNOWN",
        "Previous outcome is unknown and this operation has no request-key contract. Reconcile it before starting another mutation.",
        8,
      );
    if (hasKey)
      args.requestKey = args.requestKey || previous?.requestKey || randomUUID();
    const record = {
      origin: client.origin,
      workspace,
      operation: op.name,
      requestKey: args.requestKey ?? null,
      payloadSha256: digest,
      createdAt: previous?.createdAt || new Date().toISOString(),
      state: "intent",
    };
    await atomicJSON(file, record);
    if (args.requestKey)
      process.stderr.write(`Request key: ${args.requestKey}\n`);
    try {
      const result = await client.call(workspace, op.name, args, false);
      await atomicJSON(file, { ...record, state: "acknowledged" });
      return result;
    } catch (e) {
      if (e instanceof CliError && e.exitCode !== 8)
        await atomicJSON(file, { ...record, state: "rejected" });
      throw e;
    }
  } finally {
    await lock.close();
    await fs.rm(file + ".lock", { force: true });
  }
}
