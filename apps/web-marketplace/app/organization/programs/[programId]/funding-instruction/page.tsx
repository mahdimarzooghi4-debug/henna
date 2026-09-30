import { OrganizationFundingInstruction } from "../../../../../components/organization-funding-instruction";

export const dynamic = "force-dynamic";

export default async function OrganizationFundingInstructionPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  return <OrganizationFundingInstruction programId={programId} />;
}
