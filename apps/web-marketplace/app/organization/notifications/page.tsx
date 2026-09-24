import { OrganizationPortal } from "../../../components/organization-portal";
import { loadCurrentOrganizationProfile } from "../../../lib/server-organization";
import { loadCurrentOrganizationNotifications } from "../../../lib/server-organization-notifications";

export default async function OrganizationNotificationsPage() {
  const [profileState, notificationsState] = await Promise.all([
    loadCurrentOrganizationProfile(), loadCurrentOrganizationNotifications(),
  ]);
  return <OrganizationPortal screen="notifications" profileState={profileState} notificationsState={notificationsState} />;
}
