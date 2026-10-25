export const triageContract = "HENNA-SEVEN-FACTOR-HUMAN-REVIEW-TRIAGE-v1";
export const triageStatus = "DESCRIPTIVE_TRIAGE_ONLY_NOT_ADMITTED";
export const clearFinding = "NO_STRUCTURAL_BLOCKER_NOT_ADMITTED";
export const blockedFinding = "NEEDS_EXPLICIT_HUMAN_REVIEW";
export const triageReasons = [
  "COMPETING_HUMAN_REVIEWS",
  "COMPETING_FEATURE_REVIEWS",
  "ABSTAINED_OR_CONFLICTING_EVIDENCE",
  "REVIEW_OR_SOURCE_AFTER_CUTOFF",
  "FIRST_PARTY_SOURCE_LINEAGE_UNVERIFIED",
] as const;
export type TriageReason = typeof triageReasons[number];
export type TriageSelection = {selectedReviewIds: string[]; cutoffUtc: string};
export type TriageEntry = {
  reviewId: string; finding: typeof clearFinding|typeof blockedFinding;
  reasons: TriageReason[]; householdFeatureReviewCount: number;
  householdHumanReviewCount: number;
};
export type TriageResult = {
  contractVersion: typeof triageContract; status: typeof triageStatus;
  cutoffUtc: string; selectedReviewCount: number;
  sha256: string; entries: TriageEntry[];
  datasetAdmitted: false; humanConflictResolved: false;
  modelTrained: false; modelApproved: false; runtimeApplied: false;
};
const obj=(v:unknown): v is Record<string,unknown> =>
  v!==null&&typeof v==="object"&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==="string"&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const utc=(v:unknown):v is string=>typeof v==="string"&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(v)&&
  Number.isFinite(Date.parse(v));
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export function validTriageSelection(value:unknown):value is TriageSelection {
  if(!obj(value)||Object.keys(value).sort().join("|")!=="cutoffUtc|selectedReviewIds"||
    !Array.isArray(value.selectedReviewIds)||
    value.selectedReviewIds.length<1||value.selectedReviewIds.length>500||
    !value.selectedReviewIds.every(uuid)||!utc(value.cutoffUtc)||
    Date.parse(value.cutoffUtc)>Date.now()) return false;
  return new Set(value.selectedReviewIds.map((id:string)=>id.toLowerCase())).size===
    value.selectedReviewIds.length;
}
export function parseTriageResult(raw:unknown, selection:TriageSelection):TriageResult|null {
  if(!validTriageSelection(selection)||!obj(raw)||
    raw.contractVersion!==triageContract||raw.status!==triageStatus||
    !utc(raw.cutoffUtc)||Date.parse(raw.cutoffUtc)!==Date.parse(selection.cutoffUtc)||
    raw.selectedReviewCount!==selection.selectedReviewIds.length||
    typeof raw.sha256!=="string"||!/^[0-9a-f]{64}$/.test(raw.sha256)||
    !Array.isArray(raw.entries)||raw.entries.length!==selection.selectedReviewIds.length||
    raw.datasetAdmitted!==false||raw.humanConflictResolved!==false||
    raw.modelTrained!==false||raw.modelApproved!==false||raw.runtimeApplied!==false)
    return null;
  const requested=new Set(selection.selectedReviewIds.map(x=>x.toLowerCase()));
  const seen=new Set<string>();
  const entries:TriageEntry[]=[];
  for(const item of raw.entries) {
    if(!obj(item)||!uuid(item.reviewId)||!requested.has(item.reviewId.toLowerCase())||
      seen.has(item.reviewId.toLowerCase())||
      ![clearFinding,blockedFinding].includes(item.finding as typeof clearFinding)||
      !Array.isArray(item.reasons)||item.reasons.length>triageReasons.length||
      !item.reasons.every((s:unknown)=>triageReasons.includes(s as TriageReason))||
      new Set(item.reasons).size!==item.reasons.length||
      (item.finding===clearFinding)!==(item.reasons.length===0)||
      !Number.isSafeInteger(item.householdFeatureReviewCount)||
      !Number.isSafeInteger(item.householdHumanReviewCount)||
      (item.householdFeatureReviewCount as number)<1||
      (item.householdHumanReviewCount as number)<1)
      return null;
    if(((item.householdFeatureReviewCount as number)>1)!==
      item.reasons.includes("COMPETING_FEATURE_REVIEWS")||
       ((item.householdHumanReviewCount as number)>1)!==
      item.reasons.includes("COMPETING_HUMAN_REVIEWS")) return null;
    seen.add(item.reviewId.toLowerCase());
    entries.push({
      reviewId:item.reviewId,
      finding:item.finding as TriageEntry["finding"],
      reasons:item.reasons as TriageReason[],
      householdFeatureReviewCount:item.householdFeatureReviewCount as number,
      householdHumanReviewCount:item.householdHumanReviewCount as number
    });
  }
  if(seen.size!==requested.size)return null;
  return {
    contractVersion:triageContract,status:triageStatus,cutoffUtc:raw.cutoffUtc,
    selectedReviewCount:selection.selectedReviewIds.length,sha256:raw.sha256,entries,
    datasetAdmitted:false,humanConflictResolved:false,modelTrained:false,
    modelApproved:false,runtimeApplied:false
  };
}

export const triageRevalidationContract =
  "HENNA-SEVEN-FACTOR-HUMAN-REVIEW-TRIAGE-REVALIDATION-v1";
export const triageRevalidationStatus =
  "UNCHANGED_CURRENT_TRIAGE_STILL_NOT_ADMITTED";
export type TriageRevalidationRequest = TriageSelection & {expectedSha256:string};
export type TriageRevalidationResult = {
  contractVersion:typeof triageRevalidationContract;
  status:typeof triageRevalidationStatus;
  cutoffUtc:string; selectedReviewCount:number;
  expectedSha256:string; currentSha256:string; exactTriageUnchanged:true;
  datasetAdmitted:false; humanConflictResolved:false; modelTrained:false;
  modelApproved:false; runtimeApplied:false;
};

export function validTriageRevalidationRequest(value:unknown):value is TriageRevalidationRequest {
  if(!obj(value)||
    Object.keys(value).sort().join("|")!=="cutoffUtc|expectedSha256|selectedReviewIds"||
    typeof value.expectedSha256!=="string"||
    !/^[0-9a-f]{64}$/.test(value.expectedSha256))return false;
  return validTriageSelection({
    selectedReviewIds:value.selectedReviewIds,cutoffUtc:value.cutoffUtc
  });
}

export function parseTriageRevalidationResult(
  raw:unknown, request:TriageRevalidationRequest
):TriageRevalidationResult|null {
  if(!validTriageRevalidationRequest(request)||!obj(raw)||
    raw.contractVersion!==triageRevalidationContract||
    raw.status!==triageRevalidationStatus||
    !utc(raw.cutoffUtc)||
    Date.parse(raw.cutoffUtc)!==Date.parse(request.cutoffUtc)||
    raw.selectedReviewCount!==request.selectedReviewIds.length||
    raw.expectedSha256!==request.expectedSha256||
    raw.currentSha256!==request.expectedSha256||
    raw.exactTriageUnchanged!==true||
    raw.datasetAdmitted!==false||raw.humanConflictResolved!==false||
    raw.modelTrained!==false||raw.modelApproved!==false||raw.runtimeApplied!==false)
    return null;
  // Return only the approved non-admission DTO fields; discard any extra data.
  return {
    contractVersion:triageRevalidationContract,
    status:triageRevalidationStatus,
    cutoffUtc:request.cutoffUtc,
    selectedReviewCount:request.selectedReviewIds.length,
    expectedSha256:request.expectedSha256,
    currentSha256:request.expectedSha256,
    exactTriageUnchanged:true,
    datasetAdmitted:false,humanConflictResolved:false,
    modelTrained:false,modelApproved:false,runtimeApplied:false
  };
}
