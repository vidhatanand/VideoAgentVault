import {tenantAuth} from './auth.js';
import {currentPeriod,periodBounds} from './util.js';
import {RATES,RATE_VERSION,UNOBSERVED} from './provider-rates.js';
export async function billingReport(c,tid,period=currentPeriod()){
  await tenantAuth(c,tid,'billing:read','admin');
  const [start,end]=periodBounds(period);
  const events=await c.db.all('SELECT metric,SUM(quantity) quantity,SUM(quantity*unit_usd) usd FROM cost_events WHERE tenant_id=? AND created_at>=? AND created_at<? GROUP BY metric',[tid,start,end]);
  const wallet=await c.db.one('SELECT credit_micros FROM tenants WHERE id=?',[tid]);
  const ledger=await c.db.all('SELECT * FROM wallet_ledger WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',[tid]);
  const lines=events.map(e=>({...e,unit:RATES[e.metric]?.unit,source:RATES[e.metric]?.source}));
  return {period,status:'provisional_estimate',pricingVersion:RATE_VERSION,estimated:true,providerUsageUsd:events.reduce((s,e)=>s+e.usd,0),lines,wallet,ledger,unobserved:UNOBSERVED};
}
