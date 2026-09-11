import assert from 'node:assert/strict';
import {operationCatalogue,CONTRACT_VERSION} from '../../src/contracts/catalogue.js';
const groups=[
 ['Storage and library','videos_list video_get video_update videos_bulk_move_tag upload_create upload_status upload_complete video_delete folders_list folder_create folder_update folder_delete tags_list tag_create tag_rename tag_delete storage_inventory storage_asset storage_cleanup_preview'],
 ['Intelligence and source evidence','search_keyword transcript_get transcript_import source_versions evidence_search evidence_bundle finding_import media_result_import'],
 ['Processing, clips and repeatable work','timeline_delete timelines_list timeline_save clips_compose jobs_list job_get processing_quote processing_start job_cancel processing_plan processing_plan_get processing_plan_execute processing_reuse recipe_create recipe_list recipe_get batch_start batch_list batch_get batch_cancel job_events'],
 ['Playback, captions and delivery','playback_create playback_revoke share_create share_revoke media_tracks_list captions_save audio_track_attach media_track_delete exports_list download_create export_revoke'],
 ['Agent access, approvals and coordination','agent_self access_explain approval_request approvals_list run_create runs_list run_get run_close artifact_submit work_claim work_claim_update'],
 ['Analytics and integrations','analytics_report events_list rule_save webhook_create webhook_disable sources_list source_create provider_policy_get'],
];
const modes=[
 ['probe','Inspect media metadata and streams.','Container; hosted acceptance open'],
 ['transcode','Prepare adaptive streaming renditions.','Container; hosted acceptance open'],
 ['preview','Create previews, poster frames and seek sprites.','Container; hosted acceptance open'],
 ['export','Produce MP4 video or M4A audio exports.','Container; hosted acceptance open'],
 ['index','Build speech and sampled visual evidence.','Workers AI and processing services'],
 ['render','Render composed timelines and derived video.','Container; hosted acceptance open'],
 ['capture','Capture a bounded recording from a configured source.','Owner-controlled source access; hosted acceptance open'],
 ['semantic_search','Retrieve indexed evidence by semantic similarity.','Workers AI and Vectorize'],
 ['ask','Answer questions using indexed video evidence.','Workers AI; hosted acceptance open'],
 ['summarize','Produce a structured video summary.','Workers AI; hosted acceptance open'],
 ['embed_artifacts','Embed existing artifacts for semantic retrieval.','Workers AI and Vectorize'],
 ['generate_image','Generate an image asset with the configured model.','Workers AI; hosted acceptance open'],
 ['generate_speech','Generate a speech asset with the configured model.','Workers AI; hosted acceptance open'],
 ['stream','Encode through optional Cloudflare Stream and import an MP4.','Disabled in the default preview configuration'],
 ['stream_import','Import an existing Stream recording.','Compatibility path; disabled in the default preview configuration'],
];
const cell=s=>s.replace(/\btenant\b/gi,'workspace').replace(/\btenants\b/gi,'workspaces').replaceAll('|','\\|').replace(/\s+/g,' ').trim();
export function featureCatalogue(){
 const operations=operationCatalogue(),byName=new Map(operations.map(op=>[op.name,op]));
 assert.deepEqual(modes.map(m=>m[0]).sort(),[...byName.get('processing_start').inputSchema.properties.kind.enum].sort(),'Document every processing mode');
 const names=groups.flatMap(([,names])=>names.split(' '));
 assert.equal(new Set(names).size,names.length,'Duplicate documented operation');
 assert.deepEqual([...names].sort(),[...byName.keys()].sort(),'Classify every operation before regenerating the README');
 return [`<!-- feature-catalogue:start -->`,`Contract \`${CONTRACT_VERSION}\`. Every operation below comes from the runtime catalogue. Permission scopes still apply; a key sees only its authorized tools. Hosted availability depends on the configured services.`,...groups.map(([title,names])=>[
  `<details>\n<summary><strong>${title}</strong> · ${names.split(' ').length} operations</summary>`,
  '| Operation | What it enables | Required scope |',
  '| :-- | :-- | :-- |',
  ...names.split(' ').map(name=>{const op=byName.get(name);return `| [\`${name}\`](https://vidhatanand.github.io/VideoAgentVault/reference.html#${name}) | ${cell(op.description)} | \`${op.scope}\` |`;}),
  '</details>',
 ].join('\n\n').replaceAll('|\n\n|','|\n|')),`<details>\n<summary><strong>Processing modes</strong> · ${modes.length} job kinds</summary>\n\nThese modes share the \`processing_start\` operation. Model calls and container jobs require explicit budgets and configured services. The default preview does not enable the optional Stream paths.\n\n| Mode | What it does | Service or boundary |\n| :-- | :-- | :-- |\n${modes.map(([name,description,boundary])=>'| \`'+name+'\` | '+description+' | '+boundary+' |').join('\n')}\n\n</details>`, `<!-- feature-catalogue:end -->`].join('\n\n');
}
