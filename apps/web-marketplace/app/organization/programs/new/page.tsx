import { OrganizationPortal } from "../../../../components/organization-portal";
import { loadCurrentOrganizationProfile } from "../../../../lib/server-organization";

export default async function OrganizationProgramNewPage() {
  const profileState = await loadCurrentOrganizationProfile();
  return (
    <OrganizationPortal
      screen="create-program"
      profileState={profileState}
    />
  );
}
