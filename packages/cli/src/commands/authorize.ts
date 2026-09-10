import { createInterface } from "node:readline/promises";
import { CliError } from "../errors/index.js";
import { micros } from "./arguments.js";
import { quoteForOperation } from "./quotes.js";

export async function confirmTerminal(message: string): Promise<boolean> {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    return (
      (await prompt.question(message + " Type yes to authorize: ")).trim() ===
      "yes"
    );
  } finally {
    prompt.close();
  }
}
/** Only server quotes are displayed; every paid operation has an explicit quote path. */
export async function authorizePaid(
  client: any,
  workspace: string,
  op: any,
  args: any,
  flags: any,
  terminal = !!process.stdin.isTTY && !!process.stderr.isTTY,
  confirm = confirmTerminal,
) {
  const budget = micros(flags["max-usd"]);
  args.budgetMicros = budget;
  if (flags.yes) {
    if (op.name === "processing_plan_execute" && args.approved === undefined)
      args.approved = true;
    return;
  }
  if (!terminal || flags.json || flags.jsonl)
    throw new CliError(
      "AUTHORIZATION_REQUIRED",
      "Inspect jobs quote or the recipe first, then explicitly authorize with --yes --max-usd.",
      6,
    );
  const quote = await quoteForOperation(client, workspace, op.name, args);
  if (!Number.isSafeInteger(quote.reserveMicros) || quote.reserveMicros < 0)
    throw new CliError(
      "QUOTE_INVALID",
      "The server did not return a valid credit hold. No work started.",
      8,
    );
  if (quote.reserveMicros > budget)
    throw new CliError(
      "QUOTE_EXCEEDS_BUDGET",
      "The quoted hold exceeds --max-usd. No work started.",
      6,
    );
  const usd = (value: number) => (value / 1e6).toFixed(6);
  const message = `${quote.label}\nServer credit hold: $${usd(quote.reserveMicros)}. Your ceiling: $${usd(budget)}.\nUnused processing credits are returned; storage and hosting are billed separately.\n`;
  if (!(await confirm(message)))
    throw new CliError("AUTHORIZATION_DECLINED", "No paid work started.", 6);
  if (op.name === "processing_plan_execute" && args.approved === undefined)
    args.approved = true;
}
