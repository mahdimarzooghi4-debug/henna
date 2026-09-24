import { OrganizationPortal } from "../../../../components/organization-portal";
import { loadCurrentOrganizationProfile } from "../../../../lib/server-organization";
import {
  loadCurrentOrganizationRecipientProgramOptions,
} from "../../../../lib/server-organization-programs";

export default async function OrganizationAddPeoplePage() {
  const [profileState, recipientProgramOptionsState] = await Promise.all([
    loadCurrentOrganizationProfile(),
    loadCurrentOrganizationRecipientProgramOptions(),
  ]);

  return (
    <OrganizationPortal
      screen="add-people"
      profileState={profileState}
      recipientProgramOptionsState={recipientProgramOptionsState}
    />
  );
}
