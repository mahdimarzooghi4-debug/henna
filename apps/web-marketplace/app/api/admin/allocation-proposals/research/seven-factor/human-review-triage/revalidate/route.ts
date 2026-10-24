import {NextRequest} from "next/server";
import {forwardHumanReviewTriageRevalidation} from "../../../../../../../../lib/server-seven-factor-human-triage";
export function POST(request:NextRequest){return forwardHumanReviewTriageRevalidation(request);}
