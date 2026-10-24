// This is a read-only alignment check across exact XGBoost and EBM records.
// A matching historic evaluation cohort NEVER implies approved model quality.
export const peerContract = "HENNA-CROSS-MODEL-STORED-SOURCE-ALIGNMENT-v1";
export const peerAligned = "REVERIFIED_STORED_EVALUATION_LINEAGE_ALIGNED_ONLY";
export const peerMismatch = "REVERIFIED_STORED_EVALUATION_LINEAGE_MISMATCH";
export type PeerChoice = {artifactId:string;evaluationId:string;
  evaluationFingerprint:string;datasetVersion:string};
export type PeerSelection = {
  xgboostArtifactId:string; xgboostEvaluationId:string;
  ebmArtifactId:string; ebmEvaluationId:string;
};
export type PeerAlignment = {
  contractVersion:typeof peerContract; status:typeof peerAligned|typeof peerMismatch;
  manifestSha256:string;
  xgboostArtifactId:string; xgboostEvaluationId:string;
  ebmArtifactId:string; ebmEvaluationId:string;
  xgboostArtifactSha256:string; ebmArtifactSha256:string;
  xgboostEvaluationFingerprint:string; ebmEvaluationFingerprint:string;
  bothStoredContentsReverified:true; evaluationLineageAligned:boolean;
  historicalSourceAuthenticityAttested:false;
  scientificComparabilityApproved:false; winnerSelected:false;
  datasetAdmitted:false; modelRegistered:false; runtimeApplied:false;
};
const obj=(v:unknown):v is Record<string,unknown> =>
  !!v&&typeof v==="object"&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==="string"&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const equal=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export function validPeerSelection(v:unknown):v is PeerSelection {
  return obj(v)&&Object.keys(v).sort().join("|")===
    "ebmArtifactId|ebmEvaluationId|xgboostArtifactId|xgboostEvaluationId"&&
    uuid(v.xgboostArtifactId)&&uuid(v.xgboostEvaluationId)&&
    uuid(v.ebmArtifactId)&&uuid(v.ebmEvaluationId)&&
    !equal(v.xgboostEvaluationId,v.ebmEvaluationId);
}
export function parsePeerAlignment(raw:unknown,expected:PeerSelection):PeerAlignment|null {
  if(!validPeerSelection(expected)||!obj(raw)||
    raw.contractVersion!==peerContract||
    (raw.status!==peerAligned&&raw.status!==peerMismatch)||
    !sha(raw.manifestSha256)||
    !uuid(raw.xgboostArtifactId)||!equal(raw.xgboostArtifactId,expected.xgboostArtifactId)||
    !uuid(raw.xgboostEvaluationId)||!equal(raw.xgboostEvaluationId,expected.xgboostEvaluationId)||
    !uuid(raw.ebmArtifactId)||!equal(raw.ebmArtifactId,expected.ebmArtifactId)||
    !uuid(raw.ebmEvaluationId)||!equal(raw.ebmEvaluationId,expected.ebmEvaluationId)||
    !sha(raw.xgboostArtifactSha256)||!sha(raw.ebmArtifactSha256)||
    !sha(raw.xgboostEvaluationFingerprint)||!sha(raw.ebmEvaluationFingerprint)||
    raw.bothStoredContentsReverified!==true||
    typeof raw.evaluationLineageAligned!=="boolean"||
    raw.evaluationLineageAligned!==(raw.status===peerAligned)||
    (raw.evaluationLineageAligned===true&&
      raw.xgboostEvaluationFingerprint!==raw.ebmEvaluationFingerprint)||
    raw.historicalSourceAuthenticityAttested!==false||
    raw.scientificComparabilityApproved!==false||
    raw.winnerSelected!==false||raw.datasetAdmitted!==false||
    raw.modelRegistered!==false||raw.runtimeApplied!==false)
    return null;
  return {
    contractVersion:peerContract,status:raw.status,manifestSha256:raw.manifestSha256,
    xgboostArtifactId:raw.xgboostArtifactId,
    xgboostEvaluationId:raw.xgboostEvaluationId,
    ebmArtifactId:raw.ebmArtifactId,ebmEvaluationId:raw.ebmEvaluationId,
    xgboostArtifactSha256:raw.xgboostArtifactSha256,
    ebmArtifactSha256:raw.ebmArtifactSha256,
    xgboostEvaluationFingerprint:raw.xgboostEvaluationFingerprint,
    ebmEvaluationFingerprint:raw.ebmEvaluationFingerprint,
    bothStoredContentsReverified:true,
    evaluationLineageAligned:raw.evaluationLineageAligned,
    historicalSourceAuthenticityAttested:false,
    scientificComparabilityApproved:false,winnerSelected:false,
    datasetAdmitted:false,modelRegistered:false,runtimeApplied:false
  };
}
