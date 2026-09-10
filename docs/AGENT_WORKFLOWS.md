# Agent workflows

## Connect securely

Sign in to the owner UI, create a folder and connect a named agent. Save its API key in a secret manager or a private key file. Never paste a key into public examples, source code, logs or model prompts. Configure your MCP client to POST to your installation's /mcp endpoint with its Bearer authorization header.

Call agent_self first to inspect identity, scope and limits. Each key belongs to one named agent and one installation. Two agents collaborate only through folders or videos explicitly granted to both.

## Upload and understand

Use upload_create, upload binary parts through the documented REST route, inspect upload_status after an interruption, then call upload_complete. Import timestamped text with transcript_import for keyword search without a model call. An uploaded SRT playback track and an indexed transcript are distinct artifacts; captions_save supplies player captions, while transcript_import creates searchable evidence.

For speech recognition or semantic indexing, request processing_quote and then processing_start with a unique requestKey, approved budget and current expectedRevision. Watch job_get or job events. Never retry a mutation with a new key after an uncertain response; inspect the existing operation first.

## Find moments and clips

Use search_keyword to retrieve timestamped evidence. Semantic search runs as a budgeted semantic_search processing job. Keep returned evidence/source identifiers when summarizing. Use clips_compose for compatible segmented sources or a budgeted rendering/export workflow for precise re-encoding. Preserve source dependencies until derived work is no longer needed.

## Share and publish

Use playback_create to create an expiring player session within the agent's permissions. Treat player tokens as secrets. Publishing, broader sharing and deletion require their own permissions and exact approvals; write access alone does not grant them. Use the approval operations and preserve the approval ID for the reviewed action.

## Coordinate agents

Assign a private working folder to each agent and explicit shared folders for collaboration. Use current revisions for edits and task claims when multiple agents may touch the same video. Respect conflict errors: refresh, inspect the competing change and decide whether to retry. Never overwrite another agent's work blindly.

## Costs and errors

The installation pays Cloudflare directly. Workspace and agent budgets authorize estimated processing usage; they are not an account-wide Cloudflare cap. Holds are reservations, not final invoices. Review job receipts and provider billing separately. A missing model, exhausted budget or ambiguous paid effect is an explicit failure, not permission to switch providers or restart paid work.
