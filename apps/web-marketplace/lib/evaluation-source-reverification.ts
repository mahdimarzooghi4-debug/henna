export const sourceReverificationContract =
  "HENNA-EVALUATION-STORED-CONTENT-REVERIFICATION-v1";
export const sourceReverificationStatus =
  "STORED_EVALUATION_CONTENT_MATCHED_NOT_ADMITTED";
export type EvaluationReverificationSelection = {
  family: "XGBOOST" | "EBM"; artifactId: string; evaluationId: string;
};
export type EvaluationSourceReverification = {
  contractVersion: typeof sourceReverificationContract;
  family: "XGBOOST" | "EBM"; artifactId: string; trainingRunId: string;
  evaluationId: string; artifactSha256: string; evaluationFingerprint: string;
  datasetVersion: string; evaluationProtocolVersion: string;
  status: typeof sourceReverificationStatus; reconstructedEvaluationCount: number;
  artifactHashVerified: true; storedEvaluationContentMatches: true;
  firstPartyRuntimeLineageRechecked: true;
  historicalSourceAuthenticityAttested: false;
  datasetAdmitted: false; modelApproved: false;
  registryRecordCreated: false; runtimeApplied: false;
};
const obj=(v:unknown):v is Record<string,unknown> =>
  v!==null&&typeof v==="object"&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==="string"&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
export function validEvaluationReverificationSelection(v:unknown):
  v is EvaluationReverificationSelection {
  return obj(v)&&Object.keys(v).sort().join("|")==="artifactId|evaluationId|family"&&
    (v.family==="XGBOOST"||v.family==="EBM")&&uuid(v.artifactId)&&uuid(v.evaluationId);
}
export function parseEvaluationSourceReverification(
  raw:unknown,selection:EvaluationReverificationSelection,
):EvaluationSourceReverification|null {
  if(!validEvaluationReverificationSelection(selection)||!obj(raw)||
    raw.contractVersion!==sourceReverificationContract||
    raw.family!==selection.family||
    !uuid(raw.artifactId)||raw.artifactId.toLowerCase()!==selection.artifactId.toLowerCase()||
    !uuid(raw.trainingRunId)||
    !uuid(raw.evaluationId)||raw.evaluationId.toLowerCase()!==selection.evaluationId.toLowerCase()||
    !sha(raw.artifactSha256)||!sha(raw.evaluationFingerprint)||
    typeof raw.datasetVersion!=="string"||raw.datasetVersion.length<1||raw.datasetVersion.length>120||
    typeof raw.evaluationProtocolVersion!=="string"||
    !["henna-xgboost-shadow-benchmark-v3","henna-ebm-shadow-benchmark-v2"].includes(raw.evaluationProtocolVersion)||
    (raw.family==="XGBOOST"&&(
      raw.trainingRunId.toLowerCase()!==selection.artifactId.toLowerCase()||
      raw.evaluationProtocolVersion!=="henna-xgboost-shadow-benchmark-v3"))||
    (raw.family==="EBM"&&raw.evaluationProtocolVersion!=="henna-ebm-shadow-benchmark-v2")||
    raw.status!==sourceReverificationStatus||
    !Number.isSafeInteger(raw.reconstructedEvaluationCount)||
    (raw.reconstructedEvaluationCount as number)<1||
    (raw.reconstructedEvaluationCount as number)>500||
    raw.artifactHashVerified!==true||raw.storedEvaluationContentMatches!==true||
    raw.firstPartyRuntimeLineageRechecked!==true||
    raw.historicalSourceAuthenticityAttested!==false||
    raw.datasetAdmitted!==false||raw.modelApproved!==false||
    raw.registryRecordCreated!==false||raw.runtimeApplied!==false) return null;
  // Never relay additional upstream data or fabricated "approval" fields.
  return {
    contractVersion:sourceReverificationContract,
    family:selection.family,artifactId:raw.artifactId,
    trainingRunId:raw.trainingRunId,evaluationId:raw.evaluationId,
    artifactSha256:raw.artifactSha256,
    evaluationFingerprint:raw.evaluationFingerprint,
    datasetVersion:raw.datasetVersion,
    evaluationProtocolVersion:raw.evaluationProtocolVersion,
    status:sourceReverificationStatus,
    reconstructedEvaluationCount:raw.reconstructedEvaluationCount as number,
    artifactHashVerified:true,storedEvaluationContentMatches:true,
    firstPartyRuntimeLineageRechecked:true,
    historicalSourceAuthenticityAttested:false,
    datasetAdmitted:false,modelApproved:false,
    registryRecordCreated:false,runtimeApplied:false
  };
}
