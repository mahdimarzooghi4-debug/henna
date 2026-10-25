import assert from "node:assert/strict";
import test from "node:test";
import {triageContract,triageStatus,clearFinding,blockedFinding,
  validTriageSelection,parseTriageResult,triageRevalidationContract,
  triageRevalidationStatus,validTriageRevalidationRequest,parseTriageRevalidationResult} from
  "../apps/web-marketplace/lib/seven-factor-human-triage.ts";
const a="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const b="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const selection={selectedReviewIds:[a,b],cutoffUtc:"2026-10-09T12:00:00.000Z"};
const entry={reviewId:a,finding:clearFinding,reasons:[],
  householdFeatureReviewCount:1,householdHumanReviewCount:1};
const conflict={reviewId:b,finding:blockedFinding,
  reasons:["COMPETING_HUMAN_REVIEWS","ABSTAINED_OR_CONFLICTING_EVIDENCE"],
  householdFeatureReviewCount:1,householdHumanReviewCount:2};
const fingerprint="a".repeat(64);
const data={contractVersion:triageContract,status:triageStatus,
  cutoffUtc:selection.cutoffUtc,selectedReviewCount:2,sha256:fingerprint,entries:[entry,conflict],
  datasetAdmitted:false,humanConflictResolved:false,modelTrained:false,
  modelApproved:false,runtimeApplied:false};
test("explicit human selections yield descriptive reasons only",()=>{
 assert.ok(validTriageSelection(selection));
 const p=parseTriageResult(data,selection);
 assert.ok(p);
 assert.equal(p.entries[1].finding,blockedFinding);
 assert.equal(p.humanConflictResolved,false);
 assert.equal(p.datasetAdmitted,false);
 assert.equal("householdKey" in p.entries[0],false);
 assert.equal("severityLevel" in p.entries[0],false);
});
test("fail closed on unknown statuses, forged approvals, changed ID and contradictory counts",()=>{
 for(const patch of [
  {datasetAdmitted:true},{humanConflictResolved:true},
  {modelTrained:true},{modelApproved:true},{runtimeApplied:true},
  {status:"PASSED"},{selectedReviewCount:1},
  {cutoffUtc:"2026-10-08T12:00:00.000Z"},
  {entries:[entry,entry]},
  {entries:[entry,{...conflict,reviewId:a}]},
  {entries:[entry,{...conflict,reasons:[]}]},
  {entries:[entry,{...conflict,householdHumanReviewCount:1}]},
  {entries:[entry,{...conflict,finding:clearFinding}]},
  {entries:[entry,{...conflict,reasons:["UNKNOWN_REASON"]}]},
  {entries:[entry,{...conflict,householdKey:"private"}].map(x=>x)}
 ]) {
   const value=parseTriageResult({...data,...patch},selection);
   if(patch.entries?.[1]?.householdKey){assert.ok(value);assert.equal("householdKey" in value.entries[1],false);}
   else assert.equal(value,null);
 }
 for(const patch of [
  {selectedReviewIds:[]},{selectedReviewIds:[a,a]},
  {selectedReviewIds:[a,"invalid"]},{cutoffUtc:"2099-01-01T00:00:00Z"},
  {extra:"auto-admit"}
 ])assert.equal(validTriageSelection({...selection,...patch}),false);
});

test("maximum 500 reviewed IDs remains a valid bounded read-only result",()=>{
 const ids=Array.from({length:500},(_,i)=>{
   const suffix=(i+1).toString(16).padStart(12,"0");
   return "b8b52eee-b4c3-4ae5-a72a-"+suffix;
 });
 const selected={selectedReviewIds:ids,cutoffUtc:selection.cutoffUtc};
 const records=ids.map(id=>({...entry,reviewId:id}));
 const payload={...data,selectedReviewCount:500,entries:records};
 assert.ok(validTriageSelection(selected));
 const parsed=parseTriageResult(payload,selected);
 assert.ok(parsed);
 assert.equal(parsed.entries.length,500);
 assert.equal(parsed.modelApproved,false);
 assert.equal(parsed.runtimeApplied,false);
 assert.equal(parseTriageResult({...payload,entries:records.slice(1)},selected),null);
 assert.equal(validTriageSelection({...selected,selectedReviewIds:[...ids,ids[0]]}),false);
});

test("triage source-content fingerprint revalidation is exact and never admission",()=>{
 const expectedSha256="a".repeat(64);
 const request={...selection,expectedSha256};
 const result={contractVersion:triageRevalidationContract,status:triageRevalidationStatus,
  cutoffUtc:selection.cutoffUtc,selectedReviewCount:selection.selectedReviewIds.length,
  expectedSha256,currentSha256:expectedSha256,exactTriageUnchanged:true,
  datasetAdmitted:false,humanConflictResolved:false,modelTrained:false,
  modelApproved:false,runtimeApplied:false};
 assert.ok(validTriageRevalidationRequest(request));
 const parsed=parseTriageRevalidationResult(result,request);
 assert.ok(parsed);
 assert.equal(parsed.exactTriageUnchanged,true);
 assert.equal(parsed.datasetAdmitted,false);
 for(const patch of [
  {currentSha256:"b".repeat(64)},{exactTriageUnchanged:false},
  {datasetAdmitted:true},{humanConflictResolved:true},{modelTrained:true},
  {modelApproved:true},{runtimeApplied:true},{status:"ADMITTED"},
  {selectedReviewCount:1},{cutoffUtc:"2026-10-08T12:00:00.000Z"}
 ])assert.equal(parseTriageRevalidationResult({...result,...patch},request),null);
 for(const patch of [
  {expectedSha256:"bad"},{expectedSha256:"A".repeat(64)},
  {extra:true},{selectedReviewIds:[a,a]},{cutoffUtc:"2099-01-01T00:00:00Z"}
 ])assert.equal(validTriageRevalidationRequest({...request,...patch}),false);
});
