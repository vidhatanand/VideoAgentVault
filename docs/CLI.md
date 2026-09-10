# CLI and MCP clients

Use Node 24. The CLI is a development-preview distribution built from this repository's verified runtime contracts. It is not published to the npm registry and hosted acceptance remains open.

## Build and verify the distribution

```sh
npm ci --ignore-scripts
npm run cli:verify
npm run mcp:verify
```

The first command builds `.release/cli/videoagentvault-cli-0.1.0.tgz` and its SHA-256 file, extracts the archive, and runs ten CLI checks against that extracted executable. Source and the AGPL license are included. The second command runs the pinned official MCP Inspector 2.6.0 against the extracted archive and an isolated local application fixture. It requires network access to install the Inspector. It does not run paid intelligence or contact an installed application.

Successful [verification workflow runs](https://github.com/vidhatanand/VideoAgentVault/actions/workflows/verify.yml) also retain the checked archive and checksum as an artifact named for the commit, for 30 days. No stable release or npm publication is implied.

Install your verified local archive with:

```sh
npm install -g ./.release/cli/videoagentvault-cli-0.1.0.tgz
videoagentvault --help
```

## Connect a named agent

Set `VIDEOAGENTVAULT_ORIGIN` to your own HTTPS installation origin and `VIDEOAGENTVAULT_WORKSPACE` to its workspace ID. Supply the agent key through `VIDEOAGENTVAULT_API_KEY` or `--key-file`; never put the key itself in command arguments, prompts or Git. No endpoint is selected implicitly.

```sh
videoagentvault call agent_self --json
videoagentvault call upload_create --help
videoagentvault videos upload --help
videoagentvault jobs start --help
videoagentvault mcp serve
```

The stdio MCP bridge uses the same agent identity, folder grants, budget and operation contracts as direct REST requests. Configure an MCP client to run `videoagentvault mcp serve` and pass those environment variables through its secure configuration. The generated [API and MCP reference](https://vidhatanand.github.io/VideoAgentVault/reference.html) describes all 78 operations; a particular key sees only its permitted tools.

Paid calls need explicit authorization with `--yes --max-usd` or interactive confirmation. Prefer high-level upload and job commands for their resumability and bounded polling. An ambiguous mutation is recorded for reconciliation; do not create another paid job just because an acknowledgement was lost. Inspect each command's generated help for accepted options.

## Verification boundaries

Ten distribution checks cover help, transport redirects, paid-request idempotency, upload/caption recovery, search, playback-session creation, job-watch failures, atomic downloads and the MCP bridge. The independent Inspector successfully listed 65 tools for the test key and called `agent_self`. It reported zero schema portability errors and 297 warnings across 47 tools; portable schema guidance still needs review. These are local application checks, not proof of hosted owner login, real codec playback or actual model execution.
