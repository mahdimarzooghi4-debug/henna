import { cookies } from "next/headers";
import { accessTokenPattern, hanaAuthApiUrl, sessionCookieName } from "./server-auth";
import { parseOrganizationNotifications, type OrganizationNotificationsState } from "./organization-notifications";

export async function fetchOrganizationNotifications(token: string | null | undefined): Promise<OrganizationNotificationsState> {
  if (!token || !accessTokenPattern.test(token)) return { status: "unauthenticated" };
  const target = hanaAuthApiUrl("/api/v1/organization/notifications");
  if (!target) return { status: "unavailable" };
  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return { status: "unauthenticated" };
    if (upstream.status === 403) return { status: "forbidden" };
    if (!upstream.ok) return { status: "unavailable" };
    const notifications = parseOrganizationNotifications(await upstream.json());
    return notifications ? { status: "ready", notifications } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}

export async function loadCurrentOrganizationNotifications(): Promise<OrganizationNotificationsState> {
  const jar = await cookies();
  return fetchOrganizationNotifications(jar.get(sessionCookieName)?.value);
}
