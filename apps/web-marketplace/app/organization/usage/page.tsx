import { OrganizationPortal } from "../../../components/organization-portal";
import {
  loadCurrentOrganizationProfile,
} from "../../../lib/server-organization";
import {
  loadCurrentOrganizationUsageStatus,
} from "../../../lib/server-organization-usage";

export default async function OrganizationUsagePage() {
  const [profileState, usageStatusState] = await Promise.all([
    loadCurrentOrganizationProfile(),
    loadCurrentOrganizationUsageStatus(),
  ]);

  return (
    <OrganizationPortal
      screen="usage"
      profileState={profileState}
      usageStatusState={usageStatusState}
    />
  );
}
