import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { CliError } from "../errors/index.js";
const stringFlags = [
  "endpoint",
  "workspace",
  "folder",
  "profile",
  "key-file",
  "data",
  "request-key",
  "max-usd",
  "file",
  "srt",
  "title",
  "checkpoint",
  "id",
  "out",
  "cursor-file",
  "timeout",
  "interval",
  "shell",
] as const;
const booleanFlags = [
  "json",
  "jsonl",
  "help",
  "version",
  "dev",
  "yes",
  "overwrite",
] as const;
export type CliFlags = Partial<
  Record<(typeof stringFlags)[number], string> &
    Record<(typeof booleanFlags)[number], boolean>
>;
export function parse(argv: string[]): {
  values: CliFlags;
  positionals: string[];
} {
  const options: Record<string, { type: "string" | "boolean" }> =
    Object.fromEntries([
      ...stringFlags.map((key) => [key, { type: "string" as const }]),
      ...booleanFlags.map((key) => [key, { type: "boolean" as const }]),
    ]);
  try {
    const parsed = parseArgs({ args: argv, options, allowPositionals: true });
    return {
      values: parsed.values as CliFlags,
      positionals: parsed.positionals,
    };
  } catch {
    throw new CliError(
      "ARGUMENTS_INVALID",
      "Unknown flag or missing value. Run --help.",
    );
  }
}
export async function input(value?: string) {
  if (!value) return {};
  let raw = value;
  if (value === "-") {
    raw = "";
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (raw.length > 1048576)
        throw new CliError("INPUT_TOO_LARGE", "JSON input exceeds 1 MiB.");
    }
  } else if (value.startsWith("@"))
    raw = await fs.readFile(value.slice(1), "utf8");
  if (raw.length > 1048576)
    throw new CliError("INPUT_TOO_LARGE", "JSON input exceeds 1 MiB.");
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new CliError(
      "JSON_INVALID",
      "Supply a JSON object, @file, or - for stdin.",
    );
  }
  if (!obj || Array.isArray(obj) || typeof obj !== "object")
    throw new CliError("JSON_OBJECT_REQUIRED", "Arguments must be an object.");
  return obj;
}
export function micros(value?: string) {
  if (!value || !/^\d+(\.\d{1,6})?$/.test(value))
    throw new CliError(
      "BUDGET_REQUIRED",
      "Paid work requires --max-usd with up to six decimal places.",
      6,
    );
  const [a, b = ""] = value.split("."),
    n = Number(a) * 1000000 + Number(b.padEnd(6, "0"));
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new CliError(
      "BUDGET_INVALID",
      "Choose a positive, safe credit ceiling.",
      6,
    );
  return n;
}
