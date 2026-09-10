# Agent installation guide

Status: preparation only. Deployment is not implemented in this candidate.

## Prerequisites

Use Node 24, your Cloudflare account, an explicitly selected HTTPS application origin, and Cloudflare Access configured for owner login. Required runtime services are Workers, private R2, D1, Queues, Vectorize, Workers AI and Containers. Provider access, billing eligibility and model execution require separate verification; a successful resource listing does not prove them.

Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, APP_ORIGIN, ACCESS_TEAM_DOMAIN and ACCESS_AUD through your local environment. The token is secret. Do not include it in chat, Git, screenshots, shell arguments or documentation. Example identities must use owner@example.com.

Run `node scripts/doctor.mjs --json`. Correct failed checks. Add `--live` only to perform read-only provider checks in the selected account. Unknown checks remain unknown; do not mark them successful or bypass them.

## Required deployment behavior

The future installer must present the selected account, resource plan, permissions, cost assumptions and paid verification budget before applying changes. It must track resources by installation ownership and provider IDs. Resource name collisions require explicit resolution. Never adopt, overwrite or delete a resource just because its name matches.

Use pinned releases and verified container images. Keep private storage private. Protect owner login with verified Access assertions. Issue scoped agent keys only after owner authentication. Preserve an installation manifest so interrupted provisioning can resume safely. Never retry an ambiguous paid processing operation as a new job.

## Acceptance before declaring success

Verify a real upload, caption import, index, timestamped search, derived clip and secure player. Exercise an independent MCP client. Confirm denied folder access, key revocation, approval enforcement, spending limits and an isolated restore. Record what was tested, the release version, costs and unresolved limitations. No substitute provider or reduced functionality may be selected silently.

This guide is an installation contract, not evidence that these capabilities are already implemented in this preparation candidate.
