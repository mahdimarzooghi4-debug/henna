import { OrganizationHouseholdReferrals } from "../../../../../components/organization-household-referrals";

export const dynamic = "force-dynamic";

export default async function OrganizationHouseholdReferralsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  return <OrganizationHouseholdReferrals programId={programId} />;
}
