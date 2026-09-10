export function intervalFilter(row,options){return (!options.sourceVersionId||row.source_version_id===options.sourceVersionId)&&(options.startSeconds==null||row.end_seconds>=options.startSeconds)&&(options.endSeconds==null||row.start_seconds<=options.endSeconds);}
/** Reciprocal-rank fusion preserves provider scores separately from the blended rank. */
export function hybridRanking(semantic,keyword,limit=20){
 const rows=new Map();for(const [method,list] of [['semantic',semantic],['keyword',keyword]])for(const [i,row] of list.entries()){
  const found=rows.get(row.id)||{...row,rankScore:0,rankMethods:[]};found.rankScore+=1/(60+i+1);found.rankMethods.push(method);rows.set(row.id,found);
 }
 return [...rows.values()].sort((a,b)=>b.rankScore-a.rankScore||a.id.localeCompare(b.id)).slice(0,limit);
}
