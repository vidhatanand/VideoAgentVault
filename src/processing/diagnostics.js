/** Never expose exception text containing signed transfer URLs or credentials. */
export function processorFailure(value){
 return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,99}$/.test(value)?value:'PROCESSOR_EXECUTION_FAILED';
}
export function safeDiagnostics(value){
 if(!value||typeof value!=='object')return null;
 const out={};
 for(const k of ['stage','executable','processState','observationError','processorRelease','observationKind','runtimeExit','startupStage','exceptionType','exceptionCategory'])if(typeof value[k]==='string'&&/^[a-zA-Z0-9_]{1,64}$/.test(value[k]))out[k]=value[k];
 for(const k of ['commandCount','pid','rendition','updatedAt','observationFailures','lastObservedAt','runtimeExitedAt','httpStatus'])if(Number.isFinite(value[k])&&value[k]>=0)out[k]=value[k];
 if(Number.isInteger(value.exitCode)&&Math.abs(value.exitCode)<65536)out.exitCode=value.exitCode;
 if(Number.isInteger(value.runtimeExitCode)&&Math.abs(value.runtimeExitCode)<65536)out.runtimeExitCode=value.runtimeExitCode;
 return out;
}

/** Keep bounded classifications only. Arbitrary error messages, stacks and URLs never leave the process. */
export function startupDiagnostics(stage,error=null,code='CONTAINER_STARTING'){
 const type=['Error','TypeError','RangeError','AbortError','TimeoutError'].includes(error?.name)?error.name:error?'UnknownError':undefined;
 const message=String(error?.message||'');
 const category=!error?undefined:/timeout|timed out/i.test(message)?'timeout':/disconnect|connection|network|socket/i.test(message)?'transport':/capacity|instance limit|placement|resource exhausted/i.test(message)?'capacity':/reset|blockConcurrencyWhile/i.test(message)?'runtime_reset':'unclassified';
 return safeDiagnostics({startupStage:stage,exceptionType:type,exceptionCategory:category,observationError:code,updatedAt:Date.now()});
}
