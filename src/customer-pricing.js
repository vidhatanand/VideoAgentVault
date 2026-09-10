import {RATES,RATE_VERSION} from './provider-rates.js';
export const customerView=value=>value;
export const customerRates=()=>({pricingVersion:RATE_VERSION,currency:'USD',estimated:true,rates:RATES});
