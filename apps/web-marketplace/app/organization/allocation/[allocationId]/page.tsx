import { OrganizationPortalScreen } from "../../../../components/organization-portal";

export default async function OrganizationAllocationDetailPage({ params }: { params: Promise<{ allocationId: string }> }) {
  const { allocationId } = await params;
  return <OrganizationPortalScreen screen="allocation-detail" allocationId={allocationId} />;
}
