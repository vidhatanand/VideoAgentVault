# Contributing

This is a development preview. Contributions should include focused tests, clear reproduction steps and documentation for changed behavior. Keep modules small. Do not add silent provider substitutions or swallow failed processing stages.

This repository is the canonical source. Open a focused pull request here with tests and documentation. Review and merge changes here before creating versioned releases. Do not edit generated documentation or release bundles directly. Contributor attribution must be preserved.

Use Node 24. Run `npm ci --ignore-scripts`, `npm test`, and `npm run docs:build`. Runtime and processor changes also require `npm run build` with Docker and Buildx. Cloud acceptance requires a separately authorized account and budget; pull requests must not provision resources.

Never include credentials, real recordings or account identifiers. Use synthetic fixtures. Pull-request checks must run without cloud deployment credentials. Do not execute contributor-controlled code in privileged workflows.

## Contribution licensing

Contributions intended for inclusion must be available under AGPL-3.0-only, with the contributor authorized to grant those rights. Preserve third-party notices and disclose their licenses. This policy does not assign copyright or grant a separate proprietary relicensing right. Requests to use a contribution under different terms require an explicit agreement with its rights holders.
