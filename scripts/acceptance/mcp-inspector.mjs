import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fixture } from "../../tests/helpers.mjs";
import app from "../../standalone/index.js";
const exec = promisify(execFile),
  version = "2.6.0";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "vault-inspector-"));
const f = await fixture();
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await app.fetch(
      new Request(f.env.APP_ORIGIN + req.url, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      }),
      f.env,
      f.ctx,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("{}");
  }
});
try {
  await exec("tar", [
    "-xzf",
    path.resolve(".release/cli/videoagentvault-cli-0.1.0.tgz"),
    "-C",
    root,
  ]);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const config = path.join(root, "config.json");
  await fs.writeFile(
    config,
    JSON.stringify({
      mcpServers: {
        standalone: {
          type: "stdio",
          command: process.execPath,
          args: [
            path.join(root, "package/dist/main.js"),
            "mcp",
            "serve",
            "--dev",
          ],
          env: {
            VIDEOAGENTVAULT_API_KEY: f.key,
            VIDEOAGENTVAULT_ORIGIN: `http://127.0.0.1:${server.address().port}`,
            VIDEOAGENTVAULT_WORKSPACE: f.tenant.id,
          },
          cwd: process.cwd(),
          protocolEra: "legacy",
        },
      },
    }),
    { mode: 0o600 },
  );
  async function inspect(args) {
    const { stdout, stderr } = await exec(
      "npm",
      [
        "exec",
        "--yes",
        `--package=@modelcontextprotocol/inspector@${version}`,
        "--",
        "mcp-inspector",
        "--cli",
        "--config",
        config,
        "--server",
        "standalone",
        ...args,
        "--format",
        "json",
      ],
      { timeout: 90000, maxBuffer: 4 * 1024 * 1024 },
    );
    // Never print client output containing authentication or workspace metadata.
    return {
      result: JSON.parse(stdout).result,
      portability: stderr.match(/Schema portability:[^\n]+/)?.[0] || null,
    };
  }
  const listed = await inspect(["--method", "tools/list"]);
  assert.ok(listed.result.tools.some((t) => t.name === "agent_self"));
  assert.ok(listed.result.tools.some((t) => t.name === "search_keyword"));
  const called = await inspect([
    "--method",
    "tools/call",
    "--tool-name",
    "agent_self",
  ]);
  assert.equal(called.result.isError, false);
  assert.equal(called.result.structuredContent.name, "Fixture agent");
  assert.equal(called.result.structuredContent.status, "active");
  console.log(
    JSON.stringify({
      client: `Official MCP Inspector ${version}`,
      scope:
        "Extracted CLI archive and isolated local standalone runtime; not hosted acceptance",
      toolCount: listed.result.tools.length,
      authenticatedCall: "agent_self",
      portability: listed.portability,
    }),
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await f.close();
  await fs.rm(root, { recursive: true, force: true });
}
