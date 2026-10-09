import { NextRequest } from "next/server";
import { forwardAdminSeller } from "../../../../../lib/server-admin-sellers";

type Context = { params: Promise<{ path: string[] }> };

export const GET = async (request: NextRequest, context: Context) =>
  forwardAdminSeller(request, (await context.params).path, "GET");

export const POST = async (request: NextRequest, context: Context) =>
  forwardAdminSeller(request, (await context.params).path, "POST");
