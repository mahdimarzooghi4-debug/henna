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
  type OrganizationProgramOptionsState,
  type OrganizationProgramStatus,
  type OrganizationProgramSummary,
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


async function fetchAllProgramsByStatus(
  token: string,
  status: OrganizationProgramStatus,
): Promise<OrganizationProgramsState> {
  const collected: OrganizationProgramSummary[] = [];
  let page = 1;

  while (page <= 10000) {
    const result = await fetchOrganizationPrograms(token, {
      page,
      pageSize: 50,
      status,
    });
    if (result.status !== "ready") return result;

    collected.push(...result.data.items);
    if (page * result.data.pageSize >= result.data.total) {
      return {
        status: "ready",
        data: {
          items: collected,
          page: 1,
          pageSize: 50,
          total: collected.length,
        },
      };
    }
    page += 1;
  }

  return { status: "unavailable" };
}

export async function fetchOrganizationRecipientProgramOptions(
  token: string | null | undefined,
): Promise<OrganizationProgramOptionsState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const [registered, active] = await Promise.all([
    fetchAllProgramsByStatus(token, "REGISTERED"),
    fetchAllProgramsByStatus(token, "ACTIVE"),
  ]);

  for (const result of [registered, active]) {
    if (result.status === "unauthenticated" ||
      result.status === "forbidden")
      return { status: result.status };
    if (result.status !== "ready")
      return { status: "unavailable" };
  }

  const byId = new Map<string, OrganizationProgramSummary>();
  for (const program of [
    ...registered.data.items,
    ...active.data.items,
  ])
    byId.set(program.id, program);

  return {
    status: "ready",
    programs: [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fa")),
  };
}

export async function loadCurrentOrganizationRecipientProgramOptions():
Promise<OrganizationProgramOptionsState> {
  const jar = await cookies();
  return fetchOrganizationRecipientProgramOptions(
    jar.get(sessionCookieName)?.value,
  );
}
