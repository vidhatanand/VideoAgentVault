import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cloudflare } from "./cloudflare.mjs";
import {
  validatePlan,
  sameInstallation,
  accessTeam,
  verifyTeam,
} from "./installation/validation.mjs";
const { positionals, values: v } = parseArgs({
  allowPositionals: true,
  options: {
    "access-team": { type: "string" },
    account: { type: "string" },
    owner: { type: "string" },
    name: { type: "string", default: "videoagentvault" },
    budget: { type: "string", default: "0" },
    yes: { type: "boolean", default: false },
  },
});
const command = positionals[0];
if (!["plan", "apply", "status"].includes(command))
  throw new Error(
    "Usage: node scripts/install.mjs plan --account ID --owner EMAIL --budget USD | apply --yes | status",
  );
const dir = ".installation";
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
const read = async (name) =>
  JSON.parse(await fs.readFile(`${dir}/${name}.json`, "utf8"));
const save = async (name, data) => {
  await fs.writeFile(
    `${dir}/${name}.tmp`,
    JSON.stringify(data, null, 2) + "\n",
    { mode: 0o600 },
  );
  await fs.rename(`${dir}/${name}.tmp`, `${dir}/${name}.json`);
};
if (command === "status") {
  const state = await read("state");
  console.log(
    JSON.stringify({
      account: state.account,
      name: state.name,
      stage: state.stage,
      origin: state.origin,
      pending: state.pending || null,
    }),
  );
}
if (command === "plan") {
  if (
    !/^[a-z][a-z0-9-]{2,25}$/.test(v.name) ||
    !/^\d+(?:\.\d{1,2})?$/.test(v.budget) ||
    !v.owner?.match(/^[^\s'";]+@[^\s'";]+\.[^\s'";]+$/)
  )
    throw new Error(
      "Provide a resource prefix, valid owner email and non-negative dollar budget.",
    );
  const cf = cloudflare(v.account, process.env.CLOUDFLARE_API_TOKEN);
  const accessCf = cloudflare(
    v.account,
    process.env.CLOUDFLARE_ACCESS_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
  );
  // Read access does not certify permission to create the owner-login app.
  await accessCf("/access/apps?per_page=1");
  const sub = await cf("/workers/subdomain");
  if (!sub.subdomain) throw new Error("Enable your Workers subdomain first.");
  const suffix = randomBytes(4).toString("hex"),
    name = `${v.name}-${suffix}`;
  const plan = {
    schemaVersion: 1,
    installationId: randomUUID(),
    account: v.account,
    owner: v.owner.toLowerCase(),
    name,
    origin: `https://${name}.${sub.subdomain}.workers.dev`,
    budgetMicros: Math.round(Number(v.budget) * 1e6),
    ...(v["access-team"] ? { accessTeam: accessTeam(v["access-team"]) } : {}),
    resources: [
      "D1 database",
      "private R2 bucket",
      "job queue",
      "dead-letter queue",
      "384-dimensional Vectorize index",
      "Worker and processor Container",
      "Access login application",
    ],
    limits: { maxInstances: 2, maxJobSeconds: 900 },
    note: "Processing allowance is not an account-wide provider cap. Storage and idle resources may incur charges. No resources created.",
  };
  validatePlan(plan);
  if (plan.accessTeam) await verifyTeam(plan.accessTeam);
  await fs.writeFile(`${dir}/plan.json`, JSON.stringify(plan, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(JSON.stringify(plan, null, 2));
}
if (command === "apply") {
  if (!v.yes)
    throw new Error(
      "Review the saved resource plan and authorize it with apply --yes.",
    );
  const lock = await fs.open(`${dir}/apply.lock`, "wx", 0o600);
  try {
    const plan = validatePlan(await read("plan"));
    let state;
    try {
      state = await read("state");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      state = { ...plan, created: {}, stage: "provisioning" };
      await save("state", state);
    }
    sameInstallation(plan, state);
    if (state.pending)
      throw new Error(
        `RECONCILIATION_REQUIRED: ${state.pending}. Do not repeat an ambiguous create.`,
      );
    const cf = cloudflare(state.account, process.env.CLOUDFLARE_API_TOKEN);
    const accessCf = cloudflare(
      state.account,
      process.env.CLOUDFLARE_ACCESS_API_TOKEN ||
        process.env.CLOUDFLARE_API_TOKEN,
    );
    async function create(key, endpoint, body) {
      if (state.created[key]) return state.created[key];
      state.pending = key;
      await save("state", state);
      const client = endpoint.startsWith("/access/") ? accessCf : cf;
      const result = await client(endpoint, { method: "POST", body });
      state.created[key] = result;
      delete state.pending;
      await save("state", state);
      return result;
    }
    const organization = state.accessTeam
      ? { auth_domain: state.accessTeam }
      : await accessCf("/access/organizations");
    await verifyTeam(organization.auth_domain);
    const name = state.name;
    const access = await create("access", "/access/apps", {
      name: name + " owner login",
      domain: new URL(state.origin).host + "/auth/access",
      type: "self_hosted",
      session_duration: "8h",
      allowed_idps: [],
      auto_redirect_to_identity: false,
    });
    await create("accessPolicy", `/access/apps/${access.id}/policies`, {
      name: "Owner only",
      decision: "allow",
      include: [{ email: { email: state.owner } }],
    });
    const db = await create("database", "/d1/database", { name });
    await create("bucket", "/r2/buckets", { name: name + "-private" });
    await create("queue", "/queues", { queue_name: name + "-jobs" });
    await create("deadLetter", "/queues", { queue_name: name + "-dlq" });
    await create("vectors", "/vectorize/v2/indexes", {
      name: name + "-memory",
      config: { dimensions: 384, metric: "cosine" },
    });
    if (!organization.auth_domain || !access.aud)
      throw new Error(
        "Configure Cloudflare Access organization and identity provider before deployment.",
      );
    const config = JSON.parse(await fs.readFile("wrangler.jsonc", "utf8"));
    config.name = name;
    config.account_id = state.account;
    config.vars = {
      ...config.vars,
      APP_ORIGIN: state.origin,
      ACCESS_TEAM_DOMAIN: organization.auth_domain,
      ACCESS_AUD: access.aud,
    };
    config.d1_databases[0] = {
      ...config.d1_databases[0],
      database_name: name,
      database_id: db.uuid || db.id,
    };
    config.r2_buckets[0].bucket_name = name + "-private";
    config.queues.producers[0].queue = name + "-jobs";
    config.queues.consumers[0].queue = name + "-jobs";
    config.queues.consumers[0].dead_letter_queue = name + "-dlq";
    config.vectorize[0].index_name = name + "-memory";
    await fs.writeFile(
      "wrangler.installation.jsonc",
      JSON.stringify(config, null, 2) + "\n",
      { mode: 0o600 },
    );
    const wrangler = (args, input) => {
      const result = spawnSync(
        process.execPath,
        [
          "node_modules/wrangler/bin/wrangler.js",
          ...args,
          "--config",
          "wrangler.installation.jsonc",
        ],
        { input, encoding: "utf8", env: process.env },
      );
      if (result.status !== 0)
        throw new Error(
          `Wrangler ${args.slice(0, 2).join(" ")} failed. Run the documented command locally for diagnostics; output was not copied into installation logs.`,
        );
    };
    wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
    const id = config.vars.WORKSPACE_ID,
      quote = (s) => "'" + s.replaceAll("'", "''") + "'";
    const bootstrap = `INSERT INTO tenants(id,name,slug,quota_bytes,created_at,agent_security_version) SELECT ${quote(id)},'My video workspace','workspace',107374182400,${Date.now()},1 WHERE NOT EXISTS(SELECT 1 FROM tenants); INSERT INTO members(tenant_id,email,role,created_at) VALUES(${quote(id)},${quote(state.owner)},'owner',${Date.now()}) ON CONFLICT(tenant_id,email) DO NOTHING; INSERT INTO wallet_ledger(id,tenant_id,delta_micros,kind,reference,note,created_at) VALUES('installation_budget',${quote(id)},${state.budgetMicros},'topup','installation-budget','Owner-authorized estimated provider spending',${Date.now()}) ON CONFLICT(tenant_id,kind,reference) DO NOTHING;`;
    await cf(`/d1/database/${db.uuid || db.id}/query`, {
      method: "POST",
      body: { sql: bootstrap },
    });
    for (const secret of ["SIGNING_SECRET", "ENCRYPTION_SECRET"]) {
      if (state.created[secret]) continue;
      state.pending = secret;
      await save("state", state);
      wrangler(
        ["secret", "put", secret],
        randomBytes(48).toString("base64url"),
      );
      state.created[secret] = true;
      delete state.pending;
      await save("state", state);
    }
    state.stage = "configured";
    await save("state", state);
    console.log(
      JSON.stringify({
        stage: state.stage,
        origin: state.origin,
        next: "npm run build, then npx wrangler deploy --config wrangler.installation.jsonc. Verify the owner login, configured limits, and exact source offer before announcing a release.",
      }),
    );
  } finally {
    await lock.close();
    await fs.unlink(`${dir}/apply.lock`);
  }
}
