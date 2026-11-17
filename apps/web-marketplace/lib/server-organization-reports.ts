import { cookies } from "next/headers";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  sessionCookieName,
} from "./server-auth";
import {
  parseOrganizationReportsOverview,
  type OrganizationReportsOverviewState,
} from "./organization-reports";

export async function fetchOrganizationReportsOverview(
  token: string | null | undefined,
): Promise<OrganizationReportsOverviewState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target =
    hanaAuthApiUrl("/api/v1/organization/reports/overview");
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
      parseOrganizationReportsOverview(await upstream.json());
    return data
      ? { status: "ready", data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadCurrentOrganizationReportsOverview():
Promise<OrganizationReportsOverviewState> {
  const jar = await cookies();
  return fetchOrganizationReportsOverview(
    jar.get(sessionCookieName)?.value,
  );
}
