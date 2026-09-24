import { OrganizationPortal } from "../../components/organization-portal";
import { loadCurrentOrganizationProfile } from "../../lib/server-organization";

export default async function OrganizationPage() {
  const profileState = await loadCurrentOrganizationProfile();
  return <OrganizationPortal screen="dashboard" profileState={profileState} />;
}
