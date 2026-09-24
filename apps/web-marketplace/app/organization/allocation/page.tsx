import { OrganizationPortal } from "../../../components/organization-portal";
import {
  loadCurrentOrganizationAllocationReadiness,
} from "../../../lib/server-organization-allocation";
import {
  loadCurrentOrganizationProfile,
} from "../../../lib/server-organization";

export default async function OrganizationAllocationPage() {
  const [profileState, allocationReadinessState] = await Promise.all([
    loadCurrentOrganizationProfile(),
    loadCurrentOrganizationAllocationReadiness(),
  ]);

  return (
    <OrganizationPortal
      screen="allocation"
      profileState={profileState}
      allocationReadinessState={allocationReadinessState}
    />
  );
}
