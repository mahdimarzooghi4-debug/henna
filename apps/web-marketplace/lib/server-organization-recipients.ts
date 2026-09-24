import { cookies } from "next/headers";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  sessionCookieName,
} from "./server-auth";
import {
  parseOrganizationRecipientList,
  recipientListQueryString,
  type OrganizationRecipientListQuery,
  type OrganizationRecipientsState,
} from "./organization-recipients";

export async function fetchOrganizationRecipients(
  token: string | null | undefined,
  query: OrganizationRecipientListQuery,
): Promise<OrganizationRecipientsState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target = hanaAuthApiUrl("/api/v1/organization/recipients");
  if (!target) return { status: "unavailable" };
  const queryString = recipientListQueryString(query);
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

    const data = parseOrganizationRecipientList(await upstream.json());
    return data
      ? { status: "ready", data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadCurrentOrganizationRecipients(
  query: OrganizationRecipientListQuery,
): Promise<OrganizationRecipientsState> {
  const jar = await cookies();
  return fetchOrganizationRecipients(
    jar.get(sessionCookieName)?.value,
    query,
  );
}
