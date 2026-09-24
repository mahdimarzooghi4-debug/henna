import { OrganizationPortal } from "../../../components/organization-portal";
import {
  defaultProgramListQuery,
  parseOrganizationProgramPageQuery,
} from "../../../lib/organization-programs";
import { loadCurrentOrganizationProfile } from "../../../lib/server-organization";
import { loadCurrentOrganizationPrograms } from "../../../lib/server-organization-programs";

export default async function OrganizationProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const query = parseOrganizationProgramPageQuery(values);
  const profilePromise = loadCurrentOrganizationProfile();

  if (!query) {
    return (
      <OrganizationPortal
        screen="programs"
        profileState={await profilePromise}
        programsState={{ status: "invalid" }}
        programsQuery={defaultProgramListQuery}
      />
    );
  }

  const [profileState, programsState] = await Promise.all([
    profilePromise,
    loadCurrentOrganizationPrograms(query),
  ]);
  return (
    <OrganizationPortal
      screen="programs"
      profileState={profileState}
      programsState={programsState}
      programsQuery={query}
    />
  );
}
