import {fail} from '../util.js';
export function whisperInput(audio){
 return {audio,task:'transcribe',vad_filter:true,condition_on_previous_text:false,
  no_speech_threshold:0.6,log_prob_threshold:-1,compression_ratio_threshold:2.4,hallucination_silence_threshold:1};
}
/** Reject invalid alignment before any embedding or artifact writes. Never fabricate chunk timing. */
export function transcriptSegments(response,unit){
 if(typeof response?.text!=='string'||!Array.isArray(response.segments))fail(502,'INVALID_ASR_ALIGNMENT');
 if(response.segments.length>500)fail(502,'ASR_SEGMENT_LIMIT');
 const duration=unit.end-unit.start;let previous=0;
 return response.segments.flatMap(s=>{
  if(typeof s.text!=='string'||!s.text.trim())return [];
  if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>duration+.1||s.start<previous)fail(502,'INVALID_ASR_ALIGNMENT');
  previous=s.start;
  if((Number.isFinite(s.no_speech_prob)&&s.no_speech_prob>.6)||(Number.isFinite(s.avg_logprob)&&s.avg_logprob< -1)||(Number.isFinite(s.compression_ratio)&&s.compression_ratio>2.4))return [];
  // A measured silence interval must cover the whole segment before exclusion.
  if((unit.silence||[]).some(([a,b])=>s.start>=a&&s.end<=b))return [];
  return [{layer:'transcript',start:unit.start+s.start,end:Math.min(unit.end,unit.start+s.end),text:s.text,data:{alignment:'provider_segment',speechFilter:true,words:(s.words||[]).filter(w=>typeof w.word==='string'&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=s.start&&w.end>=w.start&&w.end<=s.end+.1).map(w=>({word:w.word,start:unit.start+w.start,end:Math.min(unit.end,unit.start+w.end)}))}}];
 });
}
