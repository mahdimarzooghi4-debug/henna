import test from "node:test";
import assert from "node:assert/strict";
import { parseEvaluationSourceReverification,
  sourceReverificationContract, sourceReverificationStatus,
  validEvaluationReverificationSelection } from
  "../apps/web-marketplace/lib/evaluation-source-reverification.ts";
const id="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const ev="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const selection={family:"XGBOOST",artifactId:id,evaluationId:ev};
const item={contractVersion:sourceReverificationContract,family:"XGBOOST",
  artifactId:id,trainingRunId:id,evaluationId:ev,artifactSha256:"a".repeat(64),
  evaluationFingerprint:"b".repeat(64),datasetVersion:"first-party",
  evaluationProtocolVersion:"henna-xgboost-shadow-benchmark-v3",
  status:sourceReverificationStatus,reconstructedEvaluationCount:2,
  artifactHashVerified:true,storedEvaluationContentMatches:true,
  firstPartyRuntimeLineageRechecked:true,historicalSourceAuthenticityAttested:false,
  datasetAdmitted:false,modelApproved:false,registryRecordCreated:false,runtimeApplied:false};
test("explicit selection and reconstructed stored fingerprint remain non-admitting",()=>{
  assert.equal(validEvaluationReverificationSelection(selection),true);
  const p=parseEvaluationSourceReverification(item,selection);
  assert.ok(p);
  assert.equal(p.historicalSourceAuthenticityAttested,false);
  assert.equal(p.modelApproved,false);
  assert.equal(p.reconstructedEvaluationCount,2);
  assert.equal(Object.keys(p).includes("householdKey"),false);
});
test("reject forged source rights, activation and stale or impossible results",()=>{
  for(const delta of [
    {historicalSourceAuthenticityAttested:true},{datasetAdmitted:true},
    {modelApproved:true},{registryRecordCreated:true},{runtimeApplied:true},
    {storedEvaluationContentMatches:false},{firstPartyRuntimeLineageRechecked:false},
    {artifactHashVerified:false},{status:"PASSED"},
    {reconstructedEvaluationCount:0},{reconstructedEvaluationCount:501},
    {evaluationFingerprint:"invalid"},{artifactSha256:"bad"},
    {evaluationId:id},{trainingRunId:ev},{family:"EBM"},
    {evaluationProtocolVersion:"future"}
  ])assert.equal(parseEvaluationSourceReverification({...item,...delta},selection),null);
  assert.equal(parseEvaluationSourceReverification(item,{...selection,evaluationId:id}),null);
  assert.equal(validEvaluationReverificationSelection({...selection, extra:true}),false);
});
