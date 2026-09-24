import { cookies } from "next/headers";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  sessionCookieName,
} from "./server-auth";
import {
  parseOrganizationProgramDetail,
  parseOrganizationProgramList,
  programListQueryString,
  type OrganizationProgramDetailState,
  type OrganizationProgramListQuery,
  type OrganizationProgramsState,
} from "./organization-programs";

export async function fetchOrganizationPrograms(
  token: string | null | undefined,
  query: OrganizationProgramListQuery,
): Promise<OrganizationProgramsState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target = hanaAuthApiUrl("/api/v1/organization/programs");
  if (!target) return { status: "unavailable" };
  const queryString = programListQueryString(query);
  if (queryString) target.search = queryString;

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return { status: "unauthenticated" };
    if (upstream.status === 403) return { status: "forbidden" };
    if (!upstream.ok) return { status: "unavailable" };

    const data = parseOrganizationProgramList(await upstream.json());
    return data
      ? { status: "ready", data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchOrganizationProgramDetail(
  token: string | null | undefined,
  id: string,
): Promise<OrganizationProgramDetailState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target = hanaAuthApiUrl(
    "/api/v1/organization/programs/" + encodeURIComponent(id),
  );
  if (!target) return { status: "unavailable" };

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return { status: "unauthenticated" };
    if (upstream.status === 403) return { status: "forbidden" };
    if (upstream.status === 404) return { status: "not_found" };
    if (!upstream.ok) return { status: "unavailable" };

    const program = parseOrganizationProgramDetail(await upstream.json());
    return program
      ? { status: "ready", program }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadCurrentOrganizationPrograms(
  query: OrganizationProgramListQuery,
): Promise<OrganizationProgramsState> {
  const jar = await cookies();
  return fetchOrganizationPrograms(
    jar.get(sessionCookieName)?.value,
    query,
  );
}

export async function loadCurrentOrganizationProgramDetail(
  id: string,
): Promise<OrganizationProgramDetailState> {
  const jar = await cookies();
  return fetchOrganizationProgramDetail(
    jar.get(sessionCookieName)?.value,
    id,
  );
}
