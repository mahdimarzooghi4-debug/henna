import { NextRequest } from "next/server";
import { forwardBuyerCommerce } from "../../../../../lib/server-buyer-commerce";
type Context = { params: Promise<{ path: string[] }> };
export const GET = async (r: NextRequest, c: Context) => forwardBuyerCommerce(r, (await c.params).path, "GET");
export const POST = async (r: NextRequest, c: Context) => forwardBuyerCommerce(r, (await c.params).path, "POST");
