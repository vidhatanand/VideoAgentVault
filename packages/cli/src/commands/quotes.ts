import { operation } from "./catalogue.js";
import { CliError } from "../errors/index.js";
export function quoteArguments(args: Record<string, unknown>) {
  const properties = operation("processing_quote").inputSchema.properties;
  const value = Object.fromEntries(
    Object.entries(args).filter(([key]) => Object.hasOwn(properties, key)),
  );
  if (args.kind !== "generate_speech") delete value.prompt;
  return value;
}
export async function quoteForOperation(
  client: any,
  workspace: string,
  name: string,
  args: any,
) {
  if (name === "processing_plan_execute") {
    const plan = await client.call(
      workspace,
      "processing_plan_get",
      { planId: args.planId },
      true,
    );
    return {
      ...plan.quote,
      label: `Saved plan ${args.planId} (${plan.provider})`,
    };
  }
  if (name === "batch_start") {
    const recipe = await client.call(
      workspace,
      "recipe_get",
      { recipeId: args.recipeId },
      true,
    );
    if (
      !Array.isArray(recipe.variants) ||
      !recipe.variants.length ||
      recipe.variants.length > 8
    )
      throw new CliError(
        "RECIPE_INVALID",
        "No valid bounded recipe variants. No work started.",
        8,
      );
    let reserveMicros = 0;
    for (const variant of recipe.variants) {
      const quote = await client.call(
        workspace,
        "processing_quote",
        quoteArguments(variant),
        true,
      );
      if (!Number.isSafeInteger(quote.reserveMicros) || quote.reserveMicros < 0)
        throw new CliError(
          "QUOTE_INVALID",
          "Invalid variant quote. No work started.",
          8,
        );
      reserveMicros += quote.reserveMicros;
    }
    return {
      reserveMicros,
      label: `Recipe ${args.recipeId}: ${recipe.variants.length} variants`,
    };
  }
  if (["processing_start", "processing_reuse"].includes(name))
    return {
      ...(await client.call(
        workspace,
        "processing_quote",
        quoteArguments(args),
        true,
      )),
      label: `${name}: ${args.kind}`,
    };
  throw new CliError(
    "QUOTE_UNAVAILABLE",
    "This operation has no reviewed quote contract. No work started.",
    6,
  );
}
