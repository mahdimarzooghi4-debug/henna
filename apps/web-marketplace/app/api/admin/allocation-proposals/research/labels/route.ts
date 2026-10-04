import { NextRequest } from "next/server";
import { forwardResearch } from "../../../../../../lib/server-allocation-research";
export function GET(request: NextRequest) { return forwardResearch(request, "labels"); }
export function POST(request: NextRequest) { return forwardResearch(request, "labels"); }
