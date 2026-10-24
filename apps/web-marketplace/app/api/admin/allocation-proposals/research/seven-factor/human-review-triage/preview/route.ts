import {NextRequest} from "next/server";
import {forwardHumanReviewTriage} from "../../../../../../../../lib/server-seven-factor-human-triage";
export function POST(request:NextRequest){return forwardHumanReviewTriage(request);}
