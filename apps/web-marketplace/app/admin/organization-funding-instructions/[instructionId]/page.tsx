import { AdminFundingInstructionDetail } from "../../../../components/admin-funding-instructions";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationFundingInstructionPage({
  params,
}: {
  params: Promise<{ instructionId: string }>;
}) {
  const { instructionId } = await params;
  return <AdminFundingInstructionDetail instructionId={instructionId} />;
}
