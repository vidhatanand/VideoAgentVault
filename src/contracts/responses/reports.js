import rules from './rows/detector_rules.js';
import detections from './rows/detections.js';
import ledger from './rows/wallet_ledger.js';
import {string,integer,number,array,object,nullable,extend,union} from './types.js';
export const reportResponses={
 sources_list:array(object({id:string,tenant_id:string,folder_id:nullable(string),name:string,kind:string,created_at:integer})),
 webhook_create:object({id:string,url:string,secret:string,signature:string}),webhook_disable:object({disabled:{type:'boolean',enum:[true]}}),
 events_list:union(object({detections:array(detections)}),object({rules:array(rules),detections:array(extend(detections,{name:string})),webhooks:array(object({id:string,url:string,enabled:integer,created_at:integer})),deliveries:array(object({id:string,event_id:string,state:string,attempts:integer,last_status:nullable(integer),created_at:integer}))})),
 billing_report:object({period:string,status:string,pricingVersion:string,tenantChargeMicros:integer,lines:array(union(object({metric:string,quantity:number,unit:string,tenantChargeMicros:integer}),object({metric:string,tenantChargeMicros:integer}))),wallet:object({credit_micros:integer}),ledger:array(extend(ledger,{},['note']))}),
 analytics_report:object({days:integer,totals:object({sessions:integer,unique_viewers:integer,watch_hours:number,buffer_seconds:number,average_startup_ms:number,completions:integer,errors:integer}),daily:array(object({day:string,sessions:integer,watch_hours:number,completions:integer})),geography:array(object({country:string,sessions:integer,watch_hours:number})),videos:array(object({id:string,title:string,sessions:integer,watch_hours:number,completions:integer})),delivery:object({requests:integer,bytes_offered:integer,cache_hits:integer}),note:string})
};
