# Contributing

This is a development preview. Contributions should include focused tests, clear reproduction steps and documentation for changed behavior. Keep modules small. Do not add silent provider substitutions or swallow failed processing stages.

This repository is the canonical source. Open a focused pull request here with tests and documentation. Review and merge changes here before creating versioned releases. Do not edit generated documentation or release bundles directly. Contributor attribution must be preserved.

Use Node 24. Run `npm ci --ignore-scripts`, `npm test`, and `npm run docs:build`. Runtime and processor changes also require `npm run build` with Docker and Buildx. Cloud acceptance requires a separately authorized account and budget; pull requests must not provision resources.

Never include credentials, real recordings or account identifiers. Use synthetic fixtures. Pull-request checks must run without cloud deployment credentials. Do not execute contributor-controlled code in privileged workflows.

## Contribution licensing

Contributions intended for inclusion must be available under AGPL-3.0-only, with the contributor authorized to grant those rights. Preserve third-party notices and disclose their licenses. This policy does not assign copyright or grant a separate proprietary relicensing right. Requests to use a contribution under different terms require an explicit agreement with its rights holders.

## Processor verification

Run real codec checks with synthetic media inside the processor image:

```sh
docker build -t videoagentvault-processor processor
docker run --rm --network none --entrypoint python -e PROCESSOR_MODULE=/app/server.py -v "$PWD/tests:/tests:ro" videoagentvault-processor -m unittest discover -s /tests -p 'test_*.py' -v
```

These tests exercise FFmpeg output, audio handling, encryption, measured progress, HTTP input limits and media validation. They have no cloud credentials and make no hosted AI requests. The public verification workflow runs them on pull requests.

## Maintainable changes

Keep changes in focused modules and preserve the generated operation contracts. Run `npm test` for runtime, UI contract, recovery and unused-import checks; run `npm run cli:verify` for the actual package and `npm run mcp:verify` for the independent local client. CLI typechecking rejects unused locals and parameters. Format new CLI, installer and recovery modules with Prettier 3.6.2. The [maintainability review](https://github.com/vidhatanand/VideoAgentVault/blob/main/docs/MAINTAINABILITY.md) records the current scope and limitations.
