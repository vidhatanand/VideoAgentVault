#!/usr/bin/env node
import { parse, input } from "./commands/arguments.js";
import {
  catalogue,
  aliases,
  operation,
  cliVersion,
} from "./commands/catalogue.js";
import { invoke } from "./commands/invoke.js";
import { settings, profiles, saveProfile } from "./config/profile.js";
import { readKey } from "./auth/key.js";
import { Client, checkedEndpoint } from "./transport/client.js";
import { serveMcp } from "./transport/mcp.js";
import { watch } from "./progress/watch.js";
import { upload } from "./uploads/upload.js";
import { saveDownload } from "./commands/download.js";
import { print } from "./output/print.js";
import { CliError } from "./errors/index.js";
async function main() {
  const { values: f, positionals: p } = parse(process.argv.slice(2)),
    command = p.slice(0, 2).join(" ");
  if (f.version) {
    print({ cliVersion, contractVersion: catalogue.contractVersion }, f);
    return;
  }
  if (f.help || !p.length) {
    const name = p[0] === "call" ? p[1] : aliases[command],
      op = operation(name);
    if (op) {
      print(op, f);
      return;
    }
    process.stdout.write(
      "VideoAgentVault — scoped video infrastructure for your agent\n\n" +
        Object.keys(aliases).sort().join("\n") +
        "\nvideos upload\njobs watch\nevents watch\nconfig set|get\ncapabilities\ncall <operation>\nmcp serve\ncompletion --shell bash|zsh|powershell\n\nOptions: --data JSON|@file|- --endpoint ORIGIN --workspace ID --profile NAME\n--key-file FILE --dev --json --jsonl --yes --max-usd AMOUNT --request-key ID\n--file VIDEO --srt CAPTIONS --folder ID --checkpoint FILE --id JOB --out FILE\n--timeout SECONDS --interval SECONDS --cursor-file FILE --overwrite\nKeys come from VIDEOAGENTVAULT_API_KEY, never a literal CLI flag. Use <command> --help for its exact schema.\n",
    );
    return;
  }
  if (p[0] === "completion") {
    const names = [
      ...new Set([
        ...Object.keys(aliases).map((s) => s.split(" ")[0]),
        "call",
        "config",
        "capabilities",
        "mcp",
        "events",
      ]),
    ].join(" ");
    if (f.shell === "bash")
      process.stdout.write(`complete -W '${names}' videoagentvault\n`);
    else if (f.shell === "zsh")
      process.stdout.write(
        `#compdef videoagentvault\n_arguments '1:command:(${names})'\n`,
      );
    else if (f.shell === "powershell")
      process.stdout.write(
        `Register-ArgumentCompleter -Native -CommandName videoagentvault -ScriptBlock { param($wordToComplete) '${names}'.Split(' ') | Where-Object { $_ -like "$wordToComplete*" } }\n`,
      );
    else
      throw new CliError("SHELL_REQUIRED", "Choose bash, zsh or powershell.");
    return;
  }
  if (command === "config get") {
    print(await profiles(), f);
    return;
  }
  if (command === "config set") {
    if (f.endpoint) checkedEndpoint(f.endpoint, f.dev);
    print(await saveProfile(f), f);
    return;
  }
  const s = await settings(f),
    origin = checkedEndpoint(s.endpoint, f.dev);
  if (p[0] === "capabilities") {
    const r = await fetch(origin + "/api/capabilities", {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok)
      throw new CliError(
        "CAPABILITIES_UNAVAILABLE",
        "This server does not provide the CLI contract. Do not assume the local candidate is deployed.",
        8,
      );
    print(await r.json(), f);
    return;
  }
  const client = new Client(
    origin,
    await readKey(f["key-file"]),
    catalogue.contractVersion,
  );
  if (command === "mcp serve") {
    await serveMcp(client);
    return;
  }
  if (!s.workspace)
    throw new CliError(
      "WORKSPACE_REQUIRED",
      "Set --workspace, VIDEOAGENTVAULT_WORKSPACE or a nonsecret profile.",
    );
  if (command === "videos upload") {
    print(await upload(client, s.workspace, f, s.folder), f);
    return;
  }
  if (command === "jobs watch" || command === "events watch") {
    print(
      await watch(client, s.workspace, f.id, f, command === "events watch"),
      f,
    );
    return;
  }
  const name = p[0] === "call" ? p[1] : aliases[command],
    op = operation(name);
  if (!op)
    throw new CliError(
      "COMMAND_UNKNOWN",
      "Unknown command. Use --help or call <operation> --help.",
    );
  const args = await input(f.data);
  if (command === "videos index") args.kind = "index";
  if (command === "exports create") args.kind = "export";
  const result = await invoke(client, s.workspace, op, args, f);
  print(
    command === "downloads get" && f.out
      ? await saveDownload(result, origin, f.out, f.overwrite)
      : result,
    f,
  );
}
main().catch((error) => {
  const known = error instanceof CliError;
  process.stderr.write(
    JSON.stringify({
      error: {
        code: known ? error.code : "CLI_FAILED",
        message: known
          ? error.message
          : "Local command failed. Check files, configuration and permissions; no automatic fallback was used.",
      },
    }) + "\n",
  );
  process.exitCode = known ? error.exitCode : 8;
});
