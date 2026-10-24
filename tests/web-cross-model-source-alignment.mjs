import test from "node:test";
import assert from "node:assert/strict";
import { peerAligned,peerMismatch,peerContract,validPeerSelection,parsePeerAlignment } from
  "../apps/web-marketplace/lib/cross-model-source-alignment.ts";
const a="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const b="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const c="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c2";
const d="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c3";
const sel={xgboostArtifactId:a,xgboostEvaluationId:b,ebmArtifactId:c,ebmEvaluationId:d};
const good={contractVersion:peerContract,status:peerAligned,
  manifestSha256:"c".repeat(64),
  xgboostArtifactId:a,xgboostEvaluationId:b,ebmArtifactId:c,ebmEvaluationId:d,
  xgboostArtifactSha256:"a".repeat(64),ebmArtifactSha256:"b".repeat(64),
  xgboostEvaluationFingerprint:"d".repeat(64),ebmEvaluationFingerprint:"d".repeat(64),
  bothStoredContentsReverified:true,evaluationLineageAligned:true,
  historicalSourceAuthenticityAttested:false,
  scientificComparabilityApproved:false,winnerSelected:false,
  datasetAdmitted:false,modelRegistered:false,runtimeApplied:false};
test("two explicitly selected research families can share reverified cohort without admission",()=>{
 assert.equal(validPeerSelection(sel),true);
 const v=parsePeerAlignment(good,sel);
 assert.ok(v);
 assert.equal(v.scientificComparabilityApproved,false);
 assert.equal(v.winnerSelected,false);
 assert.equal(v.runtimeApplied,false);
});
test("valid mismatch remains visible as mismatch, not auto winner",()=>{
 const mismatch={...good,status:peerMismatch,evaluationLineageAligned:false,
   ebmEvaluationFingerprint:"e".repeat(64)};
 assert.equal(parsePeerAlignment(mismatch,sel)?.evaluationLineageAligned,false);
});
test("block stale IDs, forged admission, fake alignment and bad witness",()=>{
 assert.equal(validPeerSelection({...sel,extra:true}),false);
 assert.equal(validPeerSelection({...sel,ebmEvaluationId:b}),false);
 for(const patch of [
  {xgboostEvaluationId:d},{ebmArtifactId:b},{winnerSelected:true},
  {modelRegistered:true},{datasetAdmitted:true},{runtimeApplied:true},
  {scientificComparabilityApproved:true},{historicalSourceAuthenticityAttested:true},
  {bothStoredContentsReverified:false},{manifestSha256:"bad"},
  {evaluationLineageAligned:false},{status:"PASSED"},
  {ebmEvaluationFingerprint:"e".repeat(64)}
 ])assert.equal(parsePeerAlignment({...good,...patch},sel),null);
});
