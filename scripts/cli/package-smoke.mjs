import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await fs.readFile("packages/cli/package.json", "utf8"),
);
const archive =
  manifest.name.replace(/^@/, "").replace("/", "-") +
  "-" +
  manifest.version +
  ".tgz";
const bytes = await fs.readFile(".release/cli/" + archive),
  hash = (
    await fs.readFile(".release/cli/" + archive + ".sha256", "utf8")
  ).split(" ")[0];
if (createHash("sha256").update(bytes).digest("hex") !== hash)
  throw new Error("Checksum mismatch");
const tmp = await fs.mkdtemp(
  path.join(os.tmpdir(), "videoagentvault-package-"),
);
try {
  let r = spawnSync(
    "tar",
    ["-xzf", path.resolve(".release/cli/" + archive), "-C", tmp],
    { encoding: "utf8" },
  );
  if (r.status) throw new Error(r.stderr);
  const main = path.join(tmp, "package", "dist", "main.js");
  for (const args of [
    ["--help"],
    ["--version"],
    ["jobs", "start", "--help"],
    ["completion", "--shell", "powershell"],
  ]) {
    r = spawnSync(process.execPath, [main, ...args], {
      env: { ...process.env, VIDEOAGENTVAULT_API_KEY: "" },
      encoding: "utf8",
    });
    if (r.status) throw new Error(r.stderr);
  }
  const version = spawnSync(process.execPath, [main, "--version", "--json"], {
    encoding: "utf8",
  });
  if (
    version.status ||
    JSON.parse(version.stdout).cliVersion !== manifest.version
  )
    throw new Error("Extracted CLI version mismatch");
  const packed = await fs.readdir(path.join(tmp, "package"));
  if (packed.some((n) => n === ".env" || n === "node_modules"))
    throw new Error("Unexpected runtime data in archive");
  r = spawnSync(
    process.execPath,
    ["--test", "tests/cli.test.mjs", "tests/cli-upload-recovery.test.mjs"],
    {
      env: { ...process.env, VIDEOAGENTVAULT_TEST_CLI: main },
      encoding: "utf8",
    },
  );
  if (r.status) throw new Error(r.stdout + "\n" + r.stderr);
  console.log(r.stdout);
  console.log(
    "Checksummed extracted CLI archive passed offline help, version, schema and completion smoke tests.",
  );
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
