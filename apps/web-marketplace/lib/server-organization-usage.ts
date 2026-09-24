import { cookies } from "next/headers";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  sessionCookieName,
} from "./server-auth";
import {
  parseOrganizationUsageStatus,
  type OrganizationUsageStatusState,
} from "./organization-usage";

export async function fetchOrganizationUsageStatus(
  token: string | null | undefined,
): Promise<OrganizationUsageStatusState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target =
    hanaAuthApiUrl("/api/v1/organization/usage/status");
  if (!target)
    return { status: "unavailable" };

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
      parseOrganizationUsageStatus(await upstream.json());
    return data
      ? { status: "ready", data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadCurrentOrganizationUsageStatus():
Promise<OrganizationUsageStatusState> {
  const jar = await cookies();
  return fetchOrganizationUsageStatus(
    jar.get(sessionCookieName)?.value,
  );
}
