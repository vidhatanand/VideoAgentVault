export function accessTeam(value) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(value || ""))
    throw new Error(
      "ACCESS_TEAM_REQUIRED: provide your existing Cloudflare Access team domain.",
    );
  return value;
}
export function validatePlan(plan) {
  if (
    !/^[a-f0-9]{32}$/i.test(plan.account || "") ||
    !/^v?[a-z][a-z0-9-]{2,48}$/.test(plan.name || "")
  )
    throw new Error("INVALID_INSTALLATION_IDENTITY");
  if (
    !Number.isSafeInteger(plan.budgetMicros) ||
    plan.budgetMicros < 0 ||
    plan.budgetMicros > 1e12
  )
    throw new Error("INVALID_INSTALLATION_BUDGET");
  if (!/^[^\s'";]+@[^\s'";]+\.[^\s'";]+$/.test(plan.owner || ""))
    throw new Error("INVALID_OWNER");
  const origin = new URL(plan.origin);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== plan.origin ||
    !origin.hostname.startsWith(plan.name + ".")
  )
    throw new Error("INVALID_INSTALLATION_ORIGIN");
  if (plan.accessTeam) accessTeam(plan.accessTeam);
  if (plan.limits?.maxInstances !== 2 || plan.limits?.maxJobSeconds !== 900)
    throw new Error("INVALID_INSTALLATION_LIMITS");
  return plan;
}
export function sameInstallation(plan, state) {
  for (const field of [
    "installationId",
    "account",
    "name",
    "origin",
    "owner",
    "budgetMicros",
    "accessTeam",
    "limits",
  ]) {
    if (JSON.stringify(plan[field]) !== JSON.stringify(state[field]))
      throw new Error("INSTALLATION_OWNERSHIP_MISMATCH:" + field);
  }
}
export async function verifyTeam(team, fetcher = fetch) {
  accessTeam(team);
  const response = await fetcher(`https://${team}/cdn-cgi/access/certs`, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || !(await response.json()).keys?.length)
    throw new Error("ACCESS_TEAM_CERTIFICATES_UNAVAILABLE");
}
