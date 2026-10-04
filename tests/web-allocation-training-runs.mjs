import assert from "node:assert/strict";
import test from "node:test";
import { parseTrainingRuns,parseTrainingRunDetail } from "../apps/web-marketplace/lib/allocation-training-runs.ts";
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
