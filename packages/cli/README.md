# VideoAgentVault CLI

Development preview. Use Node 24. Set VIDEOAGENTVAULT_ORIGIN to your installation origin and VIDEOAGENTVAULT_WORKSPACE to its workspace ID. An endpoint is required; no hosted service is selected implicitly.

Read your named agent key from VIDEOAGENTVAULT_API_KEY or --key-file. Never pass a key as a literal argument. Use --help and call <operation> --help for the generated contract.

The CLI supports resumable uploads and optional SRT, timestamped search, jobs, evidence, clips, secure players and an MCP stdio bridge. Paid operations require --yes --max-usd or interactive authorization. Unknown mutation outcomes are persisted for reconciliation, never silently retried as new work.

Build and verify from the repository with npm run cli:build and npm run cli:verify.

[Documentation](https://vidhatanand.github.io/VideoAgentVault/) · [Source](https://github.com/vidhatanand/VideoAgentVault)

AGPL-3.0-only. The package includes CLI source and license; the complete application source is available in the repository.
