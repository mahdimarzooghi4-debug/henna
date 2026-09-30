import { AdminSellerApplicationDetail } from "../../../../components/admin-seller-applications";

export const dynamic = "force-dynamic";

export default async function AdminSellerApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <AdminSellerApplicationDetail applicationId={applicationId} />;
}
