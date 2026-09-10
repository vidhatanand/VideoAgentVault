import {TOOLS} from '../mcp/catalogue.js';
export const CONTRACT_VERSION='2026-09-10.2';
export const PROTOCOL_VERSIONS=['2025-11-25','2025-06-18','2025-03-26'];
// Conventional live tools predate this candidate. They are not part of this stored-video contract.
export const OPERATIONS=TOOLS.filter(t=>!t.name.startsWith('live_'));
export function operationCatalogue(){return OPERATIONS.map(({fn,...t})=>t);}
export function capabilities(c){return {contractVersion:CONTRACT_VERSION,release:c.env.RELEASE_SHA||null,languages:['en'],features:{storedVideo:true,evidence:true,recipes:true,jobEvents:true,processing:!!c.env.MEDIA,ai:c.env.AI_ENABLED==='true'&&!!c.env.AI,semanticSearch:!!c.env.VECTORS,liveMonitoring:false,hostedAgentTeams:false,videoGeneration:false,drm:false},limits:{uploadBytes:Number(c.env.MAX_VIDEO_BYTES||4294967296),uploadPartBytes:8388608,recipeVariants:8,evidenceBundleItems:50},operations:operationCatalogue().map(({name,scope,annotations})=>({name,scope,annotations})),protocolVersions:PROTOCOL_VERSIONS};}
