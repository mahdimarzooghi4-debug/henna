import { NextRequest } from "next/server";
import { forwardPeerAlignment } from "../../../../../../lib/server-cross-model-source-alignment";
export function POST(request:NextRequest){return forwardPeerAlignment(request);}
