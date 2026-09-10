import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CliError } from "../errors/index.js";
export async function saveDownload(
  result: any,
  origin: string,
  destination: string,
  overwrite = false,
) {
  const u = new URL(result.url || result.downloadUrl, origin);
  if (u.origin !== origin || !u.pathname.startsWith("/download/"))
    throw new CliError(
      "DOWNLOAD_DESTINATION",
      "Expected a same-origin export download URL.",
      8,
    );
  const out = path.resolve(destination),
    tmp = out + "." + randomUUID() + ".partial";
  const r = await fetch(u, {
    redirect: "manual",
    signal: AbortSignal.timeout(300000),
  });
  if (!r.ok || !r.body) {
    await r.body?.cancel();
    throw new CliError(
      "DOWNLOAD_FAILED",
      "Download rejected; obtain a fresh grant if expired.",
      8,
    );
  }
  try {
    await pipeline(
      Readable.fromWeb(r.body),
      createWriteStream(tmp, { flags: "wx", mode: 0o600 }),
    );
    const st = await fs.stat(tmp),
      length = r.headers.get("content-length");
    if (length !== null && st.size !== Number(length))
      throw new CliError(
        "DOWNLOAD_TRUNCATED",
        "Download length did not match; final destination was not written.",
        8,
      );
    if (overwrite) await fs.rename(tmp, out);
    else {
      try {
        await fs.link(tmp, out);
      } catch (e) {
        if (e.code === "EEXIST")
          throw new CliError(
            "DESTINATION_EXISTS",
            "Use a new filename or explicit --overwrite.",
            5,
          );
        throw e;
      }
      await fs.unlink(tmp);
    }
    return { file: out, bytes: st.size, checksumVerified: false };
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
