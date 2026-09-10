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

## Acceptance update — 2026-09-10

- **CLI distribution verified:** ten tests passed against the checksummed extracted archive, including ambiguous upload/caption recovery, paid-request idempotency and the MCP bridge. See [CLI guide](CLI.md).
- **Independent client verified locally:** official MCP Inspector 2.6.0 listed 65 tools for a scoped test identity and completed authenticated `agent_self` through the packaged stdio bridge. It reported zero schema portability errors and 297 warnings across 47 tools. Hosted client verification is still open.
- **Isolated hosted D1 recovery verified:** all 66 application tables, application schema, permission views, foreign keys and a known FTS search matched after restoration into a separate Cloudflare database. The public capture/restore commands also passed. See [recovery procedure and limits](RECOVERY.md).
- **Hosted application blocked:** the available credential receives HTTP 403 when creating the Cloudflare Access owner-login application. The installer stopped before creating application storage or deploying the application. A scoped Access Apps and Policies Edit token is required; no authentication bypass was used.
- **Spending:** no AI or processor jobs were started. Only small isolated D1 recovery operations ran under the approved $2 test allowance. Recorded recovery rows cover the corrected round trip, not a settled provider invoice; the processing allowance is not a provider-wide cap.
- Fixed paid-action drawer inputs that violated runtime schemas, preserved permission views in recovery, and corrected shared-viewer routing. Automated tests cover these fixes. Actual browser playback remains unverified.

## Still required for production release

- Fresh hosted installation, owner login, real media and paid intelligence processing within an approved budget.
- Hosted independent MCP-client acceptance; review the Inspector schema-portability warnings. The extracted CLI distribution has passed local verification.
- Browser playback, captions, sharing, permission denial, approval and spend-limit acceptance.
- Installer interruption/reconciliation coverage; complete object, vector and secret recovery plus upgrade/rollback testing. Synthetic D1 restoration is verified.
- Dependency and processor distribution-license review, and an immutable corresponding-source offer verified against the deployed build.

Do not tag a stable release until these gates have reproducible evidence. Preserve test media and results when the installation owner requests it. Processing allowances are not account-wide Cloudflare billing caps.

## Cleanup verification

The maintainability pass removed 37 unused application imports, separated browser entry/progress modules and added unused-code regression checks. The complete local suite passes 28 tests; the extracted CLI passes ten additional distribution checks. The Worker dry-run build passed. [Verification CI for 27e0394](https://github.com/vidhatanand/VideoAgentVault/actions/runs/34496678080) passed, including all 18 processor tests, the extracted CLI and official MCP Inspector. Its checksummed CLI artifact is available from that run. [Documentation deployment](https://github.com/vidhatanand/VideoAgentVault/actions/runs/34496678191) also passed; the CLI, recovery and status pages were checked live. The three temporary synthetic D1 databases were removed after verification, with private backups and evidence retained.

## Development and releases

Develop the video, intelligence and agent contracts here. Generate reference documentation from source; publish immutable versions only after verification. Breaking contracts need a major version and migration guidance. External integrations should consume pinned releases rather than maintain independently edited copies.

No live monitoring or platform-hosted agent teams are planned for this release.
