import assert from "node:assert/strict";
import test from "node:test";
import { parseTrainingRuns,parseTrainingRunDetail } from "../apps/web-marketplace/lib/allocation-training-runs.ts";
import {
 createAllocationTrainingIntent,
 persistAllocationTrainingIntent,
 restoreAllocationTrainingIntent,
 clearAllocationTrainingIntent,
 allocationTrainingDetails,
} from "../apps/web-marketplace/lib/web-pending-allocation-training.ts";
const id="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const run={id,status:"PROPOSED",datasetVersion:"dataset",modelVersion:"model",proposalId:id,recordedAtUtc:"2026-10-04T00:00:00Z",active:false};
const detail={...run,cutoffUtc:"2026-10-03T00:00:00Z",poolRial:1000,sourceInstructionReference:"source",rubricVersion:"rubric",trainingCount:30,validationCount:10,learningMetrics:{BaselineValidationMse:.01,CandidateValidationMse:.001}};
test("completed proposal and non-improvement results remain distinct",()=>{
 assert.ok(parseTrainingRunDetail(detail));
 assert.ok(parseTrainingRunDetail({...detail,status:"NO_IMPROVEMENT",proposalId:null,learningMetrics:null}));
 assert.equal(parseTrainingRunDetail({...detail,status:"NO_IMPROVEMENT"}),null);
 assert.equal(parseTrainingRunDetail({...detail,active:true}),null);
});
test("invalid and oversized reports fail closed",()=>{
 assert.deepEqual(parseTrainingRuns({active:false,items:[]}),[]);
 assert.equal(parseTrainingRuns({active:false,items:Array(21).fill(run)}),null);
 assert.equal(parseTrainingRunDetail({...detail,poolRial:Number.MAX_SAFE_INTEGER+1}),null);
 assert.equal(parseTrainingRunDetail({...detail,validationCount:0}),null);
});


function memorySessionStorage(){
 const values=new Map();
 return {
  get length(){return values.size;},
  clear(){values.clear();},
  getItem(key){return values.has(key)?values.get(key):null;},
  key(index){return [...values.keys()][index]??null;},
  removeItem(key){values.delete(key);},
  setItem(key,value){values.set(String(key),String(value));},
 };
}

test("allocation training intent survives reload and rejects overwrite or tamper",()=>{
 const previousWindow=globalThis.window;
 const store=memorySessionStorage();
 Object.defineProperty(globalThis,"window",{
  value:{sessionStorage:store},configurable:true,writable:true,
 });
 try{
  const labels=Array.from({length:40},(_,i)=>
   `00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
  const first=createAllocationTrainingIntent(labels,1000);
  assert.deepEqual(allocationTrainingDetails(first),{
   labelIds:labels,poolRial:1000,
  });
  persistAllocationTrainingIntent(first);
  assert.deepEqual(restoreAllocationTrainingIntent(),first);

  const changed=createAllocationTrainingIntent(labels,1001);
  assert.throws(()=>persistAllocationTrainingIntent(changed),
   /must be resolved first/);
  assert.equal(clearAllocationTrainingIntent(changed.key),false);

  const storageKey=store.key(0);
  const tampered=JSON.parse(store.getItem(storageKey));
  tampered.body=JSON.stringify({labelIds:labels,poolRial:0});
  store.setItem(storageKey,JSON.stringify(tampered));
  assert.throws(()=>restoreAllocationTrainingIntent(),/invalid/);

  store.clear();
  persistAllocationTrainingIntent(first);
  assert.equal(clearAllocationTrainingIntent(first.key),true);
  assert.equal(restoreAllocationTrainingIntent(),null);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;
  else globalThis.window=previousWindow;
 }
});
