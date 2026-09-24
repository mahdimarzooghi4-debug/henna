import { notFound } from "next/navigation";
import { OrganizationPortal } from "../../../../components/organization-portal";
import {
  organizationProgramIdPattern,
} from "../../../../lib/organization-programs";
import {
  loadCurrentOrganizationAllocationProgram,
} from "../../../../lib/server-organization-allocation";
import {
  loadCurrentOrganizationProfile,
} from "../../../../lib/server-organization";

export default async function OrganizationAllocationProgramPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  if (!organizationProgramIdPattern.test(programId))
    notFound();

  const [profileState, allocationProgramState] = await Promise.all([
    loadCurrentOrganizationProfile(),
    loadCurrentOrganizationAllocationProgram(programId),
  ]);
  if (allocationProgramState.status === "not_found")
    notFound();

  return (
    <OrganizationPortal
      screen="allocation-detail"
      profileState={profileState}
      allocationProgramState={allocationProgramState}
    />
  );
}
