# Development preview status

Publication is permission to inspect, contribute and continue development. It is not production acceptance.

## Verified before this source preview

- Standalone dependency assembly excludes account administration and external identity modules.
- The exported application passed offline tests for one-workspace enforcement, named agents, independent keys, upload completion, transcript import, keyword search and suspended-key rejection.
- The originating regression suite passed 263 tests. This is supporting evidence, not a substitute for tests in this repository.
- A standalone Worker and processor Docker image dry-run build passed with Node 24.
- Developer reference generation discovers 78 stored-video operations directly from runtime contracts.

## Still required for production release

- Fresh hosted installation, owner login, real media and paid intelligence processing within an approved budget.
- Independent MCP-client acceptance and a verified CLI distribution against these contracts.
- Browser playback, captions, sharing, permission denial, approval and spend-limit acceptance.
- Installer interruption/reconciliation tests; backup restoration and upgrade testing.
- Dependency and processor distribution-license review, and an immutable corresponding-source offer verified against the deployed build.
- Public CI and documentation deployment evidence.

Do not tag a stable release until these gates have reproducible evidence. Preserve test media and results when the installation owner requests it. Processing allowances are not account-wide Cloudflare billing caps.

## Development and releases

Develop the video, intelligence and agent contracts here. Generate reference documentation from source; publish immutable versions only after verification. Breaking contracts need a major version and migration guidance. External integrations should consume pinned releases rather than maintain independently edited copies.

No live monitoring or platform-hosted agent teams are planned for this release.
