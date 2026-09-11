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
const cell=s=>s.replace(/\btenant\b/gi,'workspace').replace(/\btenants\b/gi,'workspaces').replaceAll('|','\\|').replace(/\s+/g,' ').trim();
export function featureCatalogue(){
 const operations=operationCatalogue(),byName=new Map(operations.map(op=>[op.name,op]));
 const names=groups.flatMap(([,names])=>names.split(' '));
 assert.equal(new Set(names).size,names.length,'Duplicate documented operation');
 assert.deepEqual([...names].sort(),[...byName.keys()].sort(),'Classify every operation before regenerating the README');
 return [`<!-- feature-catalogue:start -->`,`Contract \`${CONTRACT_VERSION}\`. Every operation below comes from the runtime catalogue. Permission scopes still apply; a key sees only its authorized tools. Hosted availability depends on the configured services.`,...groups.map(([title,names])=>[
  `<details>\n<summary><strong>${title}</strong> · ${names.split(' ').length} operations</summary>`,
  '| Operation | What it enables | Required scope |',
  '| :-- | :-- | :-- |',
  ...names.split(' ').map(name=>{const op=byName.get(name);return `| [\`${name}\`](https://vidhatanand.github.io/VideoAgentVault/reference.html#${name}) | ${cell(op.description)} | \`${op.scope}\` |`;}),
  '</details>',
 ].join('\n\n').replaceAll('|\n\n|','|\n|')),`<!-- feature-catalogue:end -->`].join('\n\n');
}
