import { OrganizationPortal } from "../../../components/organization-portal";
import {
  loadCurrentOrganizationProfile,
} from "../../../lib/server-organization";
import {
  loadCurrentOrganizationReportsOverview,
} from "../../../lib/server-organization-reports";

export default async function OrganizationReportsPage() {
  const [profileState, reportsOverviewState] = await Promise.all([
    loadCurrentOrganizationProfile(),
    loadCurrentOrganizationReportsOverview(),
  ]);

  return (
    <OrganizationPortal
      screen="reports"
      profileState={profileState}
      reportsOverviewState={reportsOverviewState}
    />
  );
}
