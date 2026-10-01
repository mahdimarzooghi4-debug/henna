import { OrganizationPortalScreen } from "../../../../components/organization-portal";

export const dynamic = "force-dynamic";
export default async function OrganizationProgramDetailPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  return <OrganizationPortalScreen screen="program-detail" programId={programId} />;
}
