import test from 'node:test';import assert from 'node:assert/strict';
import {processingArguments,approvedStart} from '../public/processing-arguments.js';import {OPERATIONS} from '../src/contracts/catalogue.js';import {validate} from '../src/mcp/validate.js';
test('every paid video drawer sends the exact accepted quote and start contract',()=>{
 for(const kind of ['index','summarize','ask','transcode','export']){
  const args=processingArguments({id:'v_fixture',revision:3},kind,{query:'What happens?'});
  assert.doesNotThrow(()=>validate(OPERATIONS.find(x=>x.name==='processing_quote').inputSchema,args.quote));
  const body=approvedStart(args.start,{reserveMicros:1000},'request-fixture');
  assert.doesNotThrow(()=>validate(OPERATIONS.find(x=>x.name==='processing_start').inputSchema,body));
  assert.equal(body.expectedRevision,3);assert.equal(body.budgetMicros,1000);
 }
 assert.throws(()=>approvedStart({},{reserveMicros:NaN},'request-fixture'),/Invalid processing estimate/);
});
