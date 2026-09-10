import test from 'node:test';import assert from 'node:assert/strict';
import {validatePlan,sameInstallation,verifyTeam} from '../scripts/installation/validation.mjs';
const plan=()=>({installationId:'test-installation',account:'a'.repeat(32),name:'vault-test',owner:'owner@example.com',origin:'https://vault-test.example.workers.dev',budgetMicros:2000000,limits:{maxInstances:2,maxJobSeconds:900},accessTeam:'example.cloudflareaccess.com'});
test('installation rejects unsafe budgets, unrelated origins and changed ownership before provisioning',()=>{
  assert.equal(validatePlan(plan()).budgetMicros,2000000);
  for(const value of [NaN,Infinity,-1,1e13,1.5])assert.throws(()=>validatePlan({...plan(),budgetMicros:value}));
  assert.throws(()=>validatePlan({...plan(),origin:'https://unrelated.example.com'}));
  for(const field of ['account','name','origin','owner','budgetMicros','accessTeam','limits'])assert.throws(()=>sameInstallation(plan(),{...plan(),[field]:'changed'}));
  assert.doesNotThrow(()=>sameInstallation(plan(),{...plan(),created:{database:{id:'new'}}}));
});
test('explicit Access team must expose certificates on its exact HTTPS origin',async()=>{
  await verifyTeam('example.cloudflareaccess.com',async(url,options)=>{assert.equal(url,'https://example.cloudflareaccess.com/cdn-cgi/access/certs');assert.equal(options.redirect,'error');return Response.json({keys:[{kid:'fixture'}]});});
  await assert.rejects(()=>verifyTeam('example.com'),/ACCESS_TEAM_REQUIRED/);
  await assert.rejects(()=>verifyTeam('example.cloudflareaccess.com',async()=>Response.json({keys:[]})),/CERTIFICATES_UNAVAILABLE/);
});
