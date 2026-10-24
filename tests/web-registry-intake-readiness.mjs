import test from "node:test";
import assert from "node:assert/strict";
import { registryIntakeContract, registryIntakeStatus,
  registryRequirementCodes, gateUnverified, parseRegistryIntakeReadiness } from
  "../apps/web-marketplace/lib/registry-intake-readiness.ts";
import { modelVersionPreflightContract,
  xgboostTechnicalStatus, xgboostExecutionFoundation } from
  "../apps/web-marketplace/lib/model-version-technical-preflight.ts";

const id="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const evalId="b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const selection={family:"XGBOOST",artifactId:id,evaluationId:evalId};
const technical={contractVersion:modelVersionPreflightContract, family:"XGBOOST",
  artifactId:id,trainingRunId:id,evaluationId:evalId,
  evaluationFingerprint:"a".repeat(64),artifactSha256:"b".repeat(64),
  datasetVersion:"first-party-v1",modelVersion:"henna-xgboost-v1-offline",
  artifactFormat:"xgboost-json",sourceInstructionReference:"source",
  evaluationProtocolVersion:"henna-xgboost-shadow-benchmark-v3",
  technicalStatus:xgboostTechnicalStatus,
  existingExecutionFoundationVersion:xgboostExecutionFoundation,
  artifactHashVerified:true,evaluationRecordLinked:true,
  productionRuntimeCompatible:false,registrationEnabled:false,
  datasetAdmitted:false,modelApproved:false,candidateCreated:false,runtimeApplied:false};
const ready={contractVersion:registryIntakeContract,manifestSha256:"c".repeat(64),
  sourceTechnicalPreflightContractVersion:modelVersionPreflightContract,
  family:"XGBOOST",artifactId:id,trainingRunId:id,evaluationId:evalId,
  evaluationFingerprint:technical.evaluationFingerprint,
  artifactSha256:technical.artifactSha256,datasetVersion:technical.datasetVersion,
  modelVersion:technical.modelVersion,artifactFormat:technical.artifactFormat,
  evaluationProtocolVersion:technical.evaluationProtocolVersion,
  existingExecutionFoundationVersion:technical.existingExecutionFoundationVersion,
  status:registryIntakeStatus,
  requirements:registryRequirementCodes.map(code=>({code,verification:gateUnverified})),
  registryRecordCreated:false,registrationAllowed:false,datasetAdmitted:false,
  approved:false,candidateCreated:false,productionCompatible:false,runtimeApplied:false};
test("read-only intake manifest preserves unverified gates without admission",()=>{
 const p=parseRegistryIntakeReadiness(ready,selection,technical);
 assert.ok(p);
 assert.equal(p.requirements.length,7);
 assert.equal(p.registrationAllowed,false);
 assert.equal(p.productionCompatible,false);
});
test("strict intake refuses forged statuses or stale selected evaluation",()=>{
 for(const delta of [
   {registryRecordCreated:true},{registrationAllowed:true},{datasetAdmitted:true},
   {approved:true},{candidateCreated:true},{productionCompatible:true},
   {runtimeApplied:true},{manifestSha256:"invalid"},{status:"PASSED"},
   {family:"EBM"},{evaluationId:id},{artifactSha256:"d".repeat(64)},
   {requirements:[...ready.requirements].reverse()},
   {requirements:ready.requirements.map((x,i)=>i===0?{...x,verification:"APPROVED"}:x)}
 ])assert.equal(parseRegistryIntakeReadiness({...ready,...delta},selection,technical),null);
 assert.equal(parseRegistryIntakeReadiness(ready,
   {...selection,evaluationId:id},technical),null);
});
