import { NextRequest } from "next/server";
import { forwardAdminOperations } from "../../../../../lib/server-admin-operations";
type Context={params:Promise<{path:string[]}>};
export const GET=async(request:NextRequest,context:Context)=>
  forwardAdminOperations(request,(await context.params).path,"GET");
export const POST=async(request:NextRequest,context:Context)=>
  forwardAdminOperations(request,(await context.params).path,"POST");
