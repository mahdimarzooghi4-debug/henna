import { cookies } from "next/headers";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  sessionCookieName,
} from "./server-auth";
import {
  parseOrganizationAllocationProgramDetail,
  parseOrganizationAllocationReadiness,
  type OrganizationAllocationProgramState,
  type OrganizationAllocationReadinessState,
} from "./organization-allocation";

export async function fetchOrganizationAllocationReadiness(
  token: string | null | undefined,
): Promise<OrganizationAllocationReadinessState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target =
    hanaAuthApiUrl("/api/v1/organization/allocation/readiness");
  if (!target) return { status: "unavailable" };

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return { status: "unauthenticated" };
    if (upstream.status === 403)
      return { status: "forbidden" };
    if (!upstream.ok)
      return { status: "unavailable" };

    const data =
      parseOrganizationAllocationReadiness(await upstream.json());
    return data
      ? { status: "ready", data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchOrganizationAllocationProgram(
  token: string | null | undefined,
  programId: string,
): Promise<OrganizationAllocationProgramState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target = hanaAuthApiUrl(
    `/api/v1/organization/allocation/readiness/${programId}`,
  );
  if (!target) return { status: "unavailable" };

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return { status: "unauthenticated" };
    if (upstream.status === 403)
      return { status: "forbidden" };
    if (upstream.status === 404)
      return { status: "not_found" };
    if (!upstream.ok)
      return { status: "unavailable" };

    const data =
      parseOrganizationAllocationProgramDetail(await upstream.json());
    return data
      ? { status: "ready", data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadCurrentOrganizationAllocationReadiness():
Promise<OrganizationAllocationReadinessState> {
  const jar = await cookies();
  return fetchOrganizationAllocationReadiness(
    jar.get(sessionCookieName)?.value,
  );
}

export async function loadCurrentOrganizationAllocationProgram(
  programId: string,
): Promise<OrganizationAllocationProgramState> {
  const jar = await cookies();
  return fetchOrganizationAllocationProgram(
    jar.get(sessionCookieName)?.value,
    programId,
  );
}
