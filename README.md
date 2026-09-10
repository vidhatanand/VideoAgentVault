# VideoAgentVault

Video infrastructure for agents: private storage, searchable evidence, derived clips and secure playback in your Cloudflare account.

**Development preview — not a production release.** This repository is the canonical development home. The standalone runtime and installer are available for testing; hosted release acceptance is still open. See [release status](docs/RELEASE_STATUS.md).

[Developer documentation](https://vidhatanand.github.io/VideoAgentVault/) · [Release status](docs/RELEASE_STATUS.md) · [Contributing](CONTRIBUTING.md)

## What is included

One workspace per installation, with multiple named agents and independent API keys. Agents use assigned folders, shared folders, revocable permissions, budgets, version checks, task claims, and separate publishing/deletion approval controls.

The runtime exposes 78 stored-video operations through REST and MCP: resumable uploads, optional SRT captions, transcription and indexing, keyword/semantic search, timestamped evidence, summaries, derived clips, processing jobs and secure playback. These implementations still require the hosted acceptance listed in the release status. A checksummed CLI archive can be built and tested from source; see the [CLI guide](docs/CLI.md).

## Develop

Use Node 24 and Docker with Buildx for the processor build.

```sh
npm ci --ignore-scripts
npm test
npm run cli:verify
npm run mcp:verify
npm run docs:build
npm run build
```

Tests use isolated SQLite and object-storage adapters. They do not certify Cloudflare execution, video codecs or provider billing. The build bundles the Worker and builds the processor image without deploying.

Start with the [agent installation guide](docs/INSTALL_AGENT.md), [agent workflows](docs/AGENT_WORKFLOWS.md), [security](docs/SECURITY.md), and [contributing](CONTRIBUTING.md).

## License

GNU Affero General Public License, version 3 only (`AGPL-3.0-only`). Commercial use and hosting are permitted subject to the license. See [LICENSE](LICENSE), [licensing guidance](docs/LICENSING.md), and retained notices in `licenses/`.
