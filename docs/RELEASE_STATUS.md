# Development preview status

Publication is permission to inspect, contribute and continue development. It is not production acceptance.

## Verified before this source preview

- Standalone dependency assembly excludes account administration and external identity modules.
- The exported application passed offline tests for one-workspace enforcement, named agents, independent keys, upload completion, transcript import, keyword search and suspended-key rejection.
- The originating regression suite passed 263 tests. This is supporting evidence, not a substitute for tests in this repository.
- A standalone Worker and processor Docker image dry-run build passed with Node 24.
- All 18 synthetic-media processor tests passed in that image with network disabled, including real encrypted HLS/decryption, cuts, text overlays, audio exports, progress and input limits.
- Developer reference generation discovers 78 stored-video operations directly from runtime contracts.
- [Public CI](https://github.com/vidhatanand/VideoAgentVault/actions/runs/34470162781) passed for the initial source preview. The public test suite also checks folder denial and MCP initialization, listing and search; these are offline protocol checks, not independent-client hosted acceptance.

## Documentation publication

[GitHub Pages documentation](https://vidhatanand.github.io/VideoAgentVault/) is live. The [first deployment](https://github.com/vidhatanand/VideoAgentVault/actions/runs/34470162743) succeeded. Browser verification confirmed the home page, reference navigation, operation search and desktop layout. Automated generation tests verify all local page links and the 78-operation contract mapping. Physical-device and mobile browser coverage is not claimed.

## Still required for production release

- Fresh hosted installation, owner login, real media and paid intelligence processing within an approved budget.
- Independent MCP-client acceptance and a verified CLI distribution against these contracts.
- Browser playback, captions, sharing, permission denial, approval and spend-limit acceptance.
- Installer interruption/reconciliation tests; backup restoration and upgrade testing.
- Dependency and processor distribution-license review, and an immutable corresponding-source offer verified against the deployed build.

Do not tag a stable release until these gates have reproducible evidence. Preserve test media and results when the installation owner requests it. Processing allowances are not account-wide Cloudflare billing caps.

## Development and releases

Develop the video, intelligence and agent contracts here. Generate reference documentation from source; publish immutable versions only after verification. Breaking contracts need a major version and migration guidance. External integrations should consume pinned releases rather than maintain independently edited copies.

No live monitoring or platform-hosted agent teams are planned for this release.
