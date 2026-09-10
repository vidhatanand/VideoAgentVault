import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { restoreSnapshot } from "./restore-snapshot.mjs";
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function writeBundle(directory, snapshot, metadata = {}) {
  await fs.mkdir(directory, { mode: 0o700 });
  const bytes = Buffer.from(JSON.stringify(snapshot) + "\n");
  await fs.writeFile(path.join(directory, "snapshot.json"), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  const verification = restoreSnapshot(
    snapshot,
    path.join(directory, "verified.sqlite"),
  );
  const manifest = {
    version: 1,
    snapshotSha256: sha256(bytes),
    capturedAt: snapshot.capturedAt,
    metadata,
    verification,
  };
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return manifest;
}
export async function readBundle(directory) {
  const manifest = JSON.parse(
      await fs.readFile(path.join(directory, "manifest.json")),
    ),
    bytes = await fs.readFile(path.join(directory, "snapshot.json"));
  if (manifest.version !== 1 || sha256(bytes) !== manifest.snapshotSha256)
    throw new Error("BACKUP_CHECKSUM_MISMATCH");
  return { manifest, snapshot: JSON.parse(bytes) };
}
