import {pathToFileURL} from 'node:url';
import path from 'node:path';

export function configurationChecks(config, nodeVersion = process.versions.node) {
  const checks = [];
  const add = (name, ok, remediation) => checks.push({name, status: ok ? 'passed' : 'failed', ...(ok ? {} : {remediation})});
  const [major, minor] = nodeVersion.split('.').map(Number);
  add('node', major === 24 || major === 22 && minor >= 13, 'Use Node 24, or Node 22.13 or newer within Node 22.');
  add('account', /^[a-f0-9]{32}$/i.test(config.accountId || ''), 'Select your Cloudflare account explicitly.');
  add('token', Boolean(config.token), 'Set CLOUDFLARE_API_TOKEN in the environment; never paste it into a prompt or command argument.');
  let origin;
  try { origin = new URL(config.origin); } catch {}
  add('origin', Boolean(origin && origin.protocol === 'https:' && origin.pathname === '/' && !origin.search && !origin.hash && !origin.username && !origin.password), 'Provide an HTTPS origin without credentials, path, query or fragment.');
  add('access', /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.accessTeam || '') && Boolean(config.accessAudience), 'Configure Cloudflare Access for owner login and supply its team domain and audience.');
  return checks;
}

export async function doctor(config, {live = false, fetcher = fetch, nodeVersion} = {}) {
  const checks = configurationChecks(config, nodeVersion);
  const endpoints = [
    ['d1Read', '/d1/database?per_page=1'], ['r2Read', '/r2/buckets?per_page=1'],
    ['queuesRead', '/queues?per_page=1'], ['vectorizeRead', '/vectorize/v2/indexes?per_page=1'],
  ];
  if (live && !checks.some(c => c.status === 'failed')) {
    for (const [name, endpoint] of endpoints) {
      try {
        const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}${endpoint}`, {
          headers: {Authorization: `Bearer ${config.token}`}, redirect: 'error', signal: AbortSignal.timeout(15000),
        });
        // Never echo response bodies: they can contain account details or credentials.
        const data = await response.json();
        checks.push({name, status: response.ok && data.success === true ? 'passed' : 'failed', httpStatus: response.status});
      } catch { checks.push({name, status: 'failed', remediation: 'Check connectivity and account permissions; provider details were redacted.'}); }
    }
  } else for (const [name] of endpoints) checks.push({name, status: 'unknown', remediation: 'Run --live after local configuration checks pass.'});
  for (const name of ['resourceWritePermissions', 'containersEligibility', 'aiModelExecution', 'accessPolicy', 'domainOwnership', 'billingEnrollment']) {
    checks.push({name, status: 'unknown', remediation: 'Requires deployment-plan verification; listing resources does not establish this capability.'});
  }
  return {schemaVersion: 1, readyToDeploy: false, checks};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(x => !['--live', '--json'].includes(x))) throw new Error('Usage: node scripts/doctor.mjs [--live] [--json]');
  const result = await doctor({accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN,
    origin: process.env.APP_ORIGIN, accessTeam: process.env.ACCESS_TEAM_DOMAIN, accessAudience: process.env.ACCESS_AUD},
    {live: process.argv.includes('--live')});
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.checks.some(c => c.status === 'failed') ? 1 : 2;
}
