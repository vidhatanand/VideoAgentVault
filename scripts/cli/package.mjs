import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
await fs.mkdir(".release/cli", { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npm,
  ["pack", "./packages/cli", "--pack-destination", ".release/cli", "--json"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (result.status !== 0) throw new Error(result.stderr);
const [info] = JSON.parse(result.stdout),
  file = ".release/cli/" + info.filename,
  bytes = await fs.readFile(file);
await fs.writeFile(
  file + ".sha256",
  createHash("sha256").update(bytes).digest("hex") +
    "  " +
    info.filename +
    "\n",
);
console.log(file);
