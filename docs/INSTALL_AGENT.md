# Agent installation guide

Status: development preview. The installer is implemented but hosted acceptance is not complete. Do not deploy for production use yet.

## Prerequisites

Use Node 24, your Cloudflare account, an explicitly selected HTTPS application origin, and Cloudflare Access configured for owner login. Creating the owner-login application requires Access Apps and Policies Edit permission; read-only app listing is insufficient. Required runtime services are Workers, private R2, D1, Queues, Vectorize, Workers AI and Containers. Provider access, billing eligibility and model execution require separate verification; a successful resource listing does not prove them.

Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, APP_ORIGIN, ACCESS_TEAM_DOMAIN and ACCESS_AUD through your local environment. The token is secret. Do not include it in chat, Git, screenshots, shell arguments or documentation. Example identities must use owner@example.com.

Run `node scripts/doctor.mjs --json`. Correct failed checks. Add `--live` only to perform read-only provider checks in the selected account. Unknown checks remain unknown; do not mark them successful or bypass them.

## Required deployment behavior

The installer must present the selected account, resource plan, permissions, cost assumptions and paid verification budget before applying changes. It must track resources by installation ownership and provider IDs. Resource name collisions require explicit resolution. Never adopt, overwrite or delete a resource just because its name matches.

Use pinned releases and verified container images. Keep private storage private. Protect owner login with verified Access assertions. Issue scoped agent keys only after owner authentication. Preserve an installation manifest so interrupted provisioning can resume safely. Never retry an ambiguous paid processing operation as a new job.

## Acceptance before declaring success

Verify a real upload, caption import, index, timestamped search, derived clip and secure player. Exercise an independent MCP client. Confirm denied folder access, key revocation, approval enforcement, spending limits and an isolated restore. Record what was tested, the release version, costs and unresolved limitations. No substitute provider or reduced functionality may be selected silently.

## Preview installation commands

After `npm ci --ignore-scripts`, provide the API token through a secure environment and run:

```sh
node scripts/install.mjs plan --account YOUR_ACCOUNT_ID --owner owner@example.com --name videoagentvault --budget 2 --access-team YOUR_TEAM.cloudflareaccess.com
```

The plan is saved in `.installation/plan.json`; no resources are created by `plan`. `status` is available after an apply has created installation state. Review the plan and obtain authorization for resources and spend before running:

```sh
node scripts/install.mjs apply --yes
node scripts/install.mjs status
npm run build
npx wrangler deploy --config wrangler.installation.jsonc
```

The saved installation state and generated configuration contain private identifiers. Never commit them. An ambiguous create stops with `RECONCILIATION_REQUIRED`; inspect the provider resource before resolving it. Do not erase state to bypass that stop. Secrets, hosted Access login and deployment remain acceptance gates.

These commands describe the implemented preview workflow, not successful hosted installation evidence.

If infrastructure and Access use separately scoped credentials, set `CLOUDFLARE_ACCESS_API_TOKEN` explicitly for Access API calls. When it is unset, the installer uses the primary token for every service. The team domain is verified through its public certificate endpoint. This avoids needing organization-metadata permission when the owner supplies the team explicitly; it does not bypass Access app creation or policy checks. A 403 from Access creation leaves a pending step for reconciliation and creates no application storage.

After provisioning, supply the generated Access audience and origin to the doctor checks. A pre-provisioning audience does not yet exist. Review [CLI verification](CLI.md) and [database recovery](RECOVERY.md) separately from the hosted acceptance checklist.
