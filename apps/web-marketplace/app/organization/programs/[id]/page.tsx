import { notFound } from "next/navigation";
import { OrganizationPortal } from "../../../../components/organization-portal";
import {
  organizationProgramIdPattern,
} from "../../../../lib/organization-programs";
import { loadCurrentOrganizationProfile } from "../../../../lib/server-organization";
import { loadCurrentOrganizationProgramDetail } from "../../../../lib/server-organization-programs";

export default async function OrganizationProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!organizationProgramIdPattern.test(id)) notFound();

  const [profileState, programDetailState] = await Promise.all([
    loadCurrentOrganizationProfile(),
    loadCurrentOrganizationProgramDetail(id),
  ]);
  if (programDetailState.status === "not_found") notFound();

  return (
    <OrganizationPortal
      screen="program-detail"
      profileState={profileState}
      programDetailState={programDetailState}
    />
  );
}
