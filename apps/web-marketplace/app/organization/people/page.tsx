import { OrganizationPortal } from "../../../components/organization-portal";
import {
  defaultRecipientListQuery,
  parseOrganizationRecipientPageQuery,
} from "../../../lib/organization-recipients";
import { loadCurrentOrganizationProfile } from "../../../lib/server-organization";
import { loadCurrentOrganizationRecipients } from "../../../lib/server-organization-recipients";

export default async function OrganizationPeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const query = parseOrganizationRecipientPageQuery(values);
  const profilePromise = loadCurrentOrganizationProfile();

  if (!query) {
    return (
      <OrganizationPortal
        screen="people"
        profileState={await profilePromise}
        recipientsState={{ status: "invalid" }}
        recipientsQuery={defaultRecipientListQuery}
      />
    );
  }

  const [profileState, recipientsState] = await Promise.all([
    profilePromise,
    loadCurrentOrganizationRecipients(query),
  ]);
  return (
    <OrganizationPortal
      screen="people"
      profileState={profileState}
      recipientsState={recipientsState}
      recipientsQuery={query}
    />
  );
}
