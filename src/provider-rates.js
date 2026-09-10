// Verified against official Cloudflare public price pages on 2026-09-08.
// List rates are not an invoice. Allowances are account-wide and apply ONCE.
export const RATE_VERSION='cloudflare-public-2026-09-08-v3';
export const RATES={
 r2_storage_gb_month:{unit:'GB-month (decimal)',usd:.015,included:10,source:'https://developers.cloudflare.com/r2/pricing/'},
 r2_a:{unit:'operation',usd:4.5/1e6,included:1e6,source:'https://developers.cloudflare.com/r2/pricing/'},
 r2_b:{unit:'operation',usd:.36/1e6,included:1e7,source:'https://developers.cloudflare.com/r2/pricing/'},
 workers_requests:{unit:'request',usd:.3/1e6,included:1e7,source:'https://developers.cloudflare.com/workers/platform/pricing/'},
 workers_cpu_ms:{unit:'CPU millisecond',usd:.02/1e6,included:3e7,source:'https://developers.cloudflare.com/workers/platform/pricing/'},
 d1_read:{unit:'row read',usd:.001/1e6,included:25e9,source:'https://developers.cloudflare.com/d1/platform/pricing/'},
 d1_write:{unit:'row written',usd:1/1e6,included:50e6,source:'https://developers.cloudflare.com/d1/platform/pricing/'},
 d1_storage_gb_month:{unit:'GB-month',usd:.75,included:5,source:'https://developers.cloudflare.com/d1/platform/pricing/'},
 queues_ops:{unit:'64KB operation',usd:.4/1e6,included:1e6,source:'https://developers.cloudflare.com/queues/platform/pricing/'},
 container_cpu_seconds:{unit:'active vCPU-second',usd:.000020,included:22500,source:'https://developers.cloudflare.com/containers/platform/pricing/'},
 container_memory_gib_seconds:{unit:'provisioned GiB-second',usd:.0000025,included:90000,source:'https://developers.cloudflare.com/containers/platform/pricing/'},
 container_disk_gb_seconds:{unit:'provisioned GB-second',usd:.00000007,included:720000,source:'https://developers.cloudflare.com/containers/platform/pricing/'},
 container_egress_gb:{unit:'GB; conservative highest-region list rate',usd:.05,included:0,source:'https://developers.cloudflare.com/containers/platform/pricing/'},
 vector_query_dimensions:{unit:'queried or inserted dimension',usd:.01/1e6,included:50e6,source:'https://developers.cloudflare.com/vectorize/platform/pricing/'},
 vector_stored_dimensions:{unit:'stored dimension-month',usd:.05/1e8,included:10e6,source:'https://developers.cloudflare.com/vectorize/platform/pricing/'},
 ai_asr_minutes:{unit:'audio minute',usd:.00051,included:0,source:'https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/'},
 ai_embed_tokens:{unit:'estimated input token',usd:.02/1e6,included:0,source:'https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/'},
 ai_vision_input_tokens:{unit:'input token',usd:.049/1e6,included:0,source:'https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/'},
 ai_vision_output_tokens:{unit:'output token',usd:.68/1e6,included:0,source:'https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/'},
 ai_gemma_input_tokens:{unit:'input token',usd:.10/1e6,included:0,source:'https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/'},
 ai_gemma_output_tokens:{unit:'output token',usd:.30/1e6,included:0,source:'https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/'},
 ai_tts_characters:{unit:'character',usd:.03/1000,included:0,source:'https://developers.cloudflare.com/workers-ai/models/aura-2-en/'},
 ai_tts_minutes:{unit:'audio minute',usd:.0002,included:0,source:'https://developers.cloudflare.com/workers-ai/models/melotts/'},
 ai_image_tiles:{unit:'512px tile',usd:.000053,included:0,source:'https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/'},
 ai_image_steps:{unit:'diffusion step',usd:.00011,included:0,source:'https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/'},
 stream_storage_minute_month:{unit:'minute stored-month (lifetime prorated allocation weight)',usd:.005,included:0,source:'https://developers.cloudflare.com/stream/pricing/'},
 stream_delivery_minutes:{unit:'minute delivered/exported',usd:.001,included:0,source:'https://developers.cloudflare.com/stream/pricing/'}
};
export const UNOBSERVED=['Workers CPU (unless imported)','D1 final metering writes and database bytes','Durable Object requests/duration/storage','Cloudflare Access seats','container boot/image and regional egress adjustments','failed provider calls without usage responses','AI neuron allowances / model token estimation','account-wide tier rounding, discounts, other applications and taxes'];
