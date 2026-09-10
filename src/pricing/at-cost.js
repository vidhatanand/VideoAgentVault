export {RATES,RATE_VERSION,UNOBSERVED} from '../provider-rates.js';

// Compatibility names keep processing contracts stable; values add no margin.
export const MARKUP=1;
export const STORAGE_MARKUP=1;
export const PRICING_VERSION='provider-estimates-v1';
export const STORAGE_METRICS=new Set(['r2_storage_gb_month','d1_storage_gb_month','vector_stored_dimensions','stream_storage_minute_month','container_disk_gb_seconds']);
export const markupFor=()=>1;
export function customerCostUsd(events){
  return events.reduce((sum,event)=>{
    const quantity=Number(event.quantity),unit=Number(event.unit_usd);
    if(!Number.isFinite(quantity)||quantity<0||!Number.isFinite(unit)||unit<0)throw new Error('INVALID_USAGE_RECEIPT');
    return sum+quantity*unit;
  },0);
}
