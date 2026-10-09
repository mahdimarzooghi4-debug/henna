import { NextRequest } from "next/server";
import { forwardStaffCommerce } from "../../../../../lib/server-staff-commerce";
type Context = { params: Promise<{ path: string[] }> };
export const GET = async (request: NextRequest, context: Context) =>
  forwardStaffCommerce(request, "support", (await context.params).path, "GET");
export const POST = async (request: NextRequest, context: Context) =>
  forwardStaffCommerce(request, "support", (await context.params).path, "POST");
