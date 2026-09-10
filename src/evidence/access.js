import {requireVideo} from '../library.js';
import {requireVersion} from './versions.js';
import {visibleJob} from '../access/results.js';
/** A result receipt never expands the reader's access to the evidence behind its answer. */
export async function authorizeManifest(c,row){
 await requireVideo(c,row.video_id);
 if(row.source_version_id)await requireVersion(c,row.source_version_id);
 if(row.job_id){const job=await c.db.one('SELECT * FROM jobs WHERE id=?',[row.job_id]);if(job)await visibleJob(c,job);}
}
