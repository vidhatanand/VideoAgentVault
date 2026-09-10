import fs from "node:fs/promises";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
const root = "packages/cli";
await fs.rm(root + "/dist", { recursive: true, force: true });
for (const file of await fs.readdir(root + "/src", { recursive: true })) {
  if (!file.endsWith(".ts")) continue;
  const dest = root + "/dist/" + file.replace(/\.ts$/, ".js");
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(
    dest,
    stripTypeScriptTypes(await fs.readFile(root + "/src/" + file, "utf8"), {
      mode: "strip",
    }),
  );
}
await fs.chmod(root + "/dist/main.js", 0o755);
console.log(
  "Emitted dependency-free CLI JavaScript. npm run cli:build runs the TypeScript check before this emit step.",
);
