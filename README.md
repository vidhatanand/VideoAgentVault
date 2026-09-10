# VideoAgentVault

Secure video storage and retrieval for agents.

Preparation candidate. The application and installer are not released yet.

The intended product lets you upload videos, import captions, find timestamped evidence, retrieve clips and serve secure players in your own Cloudflare account. One installation owns one workspace. Multiple agents receive separate identities, folder permissions, spending limits and approval policies.

## Available in this candidate

A read-only prerequisite checker and installation/contribution guidance. There is no deploy command, runnable video application or automatic cloud provisioning in this candidate. Do not use it as a production release.

Use Node 24. Run `node scripts/doctor.mjs --json` to inspect configuration. Set the documented environment variables before adding `--live` for read-only Cloudflare checks. Exit 1 means failed checks; exit 2 means verification is incomplete. No result currently certifies deployment readiness.

See [agent installation instructions](docs/INSTALL_AGENT.md), [security](docs/SECURITY.md), and [contributing](CONTRIBUTING.md).
