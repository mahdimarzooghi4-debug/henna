import { cookies } from "next/headers";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  sessionCookieName,
} from "./server-auth";
import {
  parseOrganizationProfile,
  type OrganizationProfileState,
} from "./organization-profile";

export async function fetchOrganizationProfile(
  token: string | null | undefined,
): Promise<OrganizationProfileState> {
  if (!token || !accessTokenPattern.test(token))
    return { status: "unauthenticated" };

  const target = hanaAuthApiUrl("/api/v1/organization/me");
  if (!target) return { status: "unavailable" };

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401) return { status: "unauthenticated" };
    if (upstream.status === 403) return { status: "forbidden" };
    if (!upstream.ok) return { status: "unavailable" };

    const profile = parseOrganizationProfile(await upstream.json());
    return profile
      ? { status: "ready", profile }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadCurrentOrganizationProfile():
  Promise<OrganizationProfileState> {
  const jar = await cookies();
  return fetchOrganizationProfile(jar.get(sessionCookieName)?.value);
}
