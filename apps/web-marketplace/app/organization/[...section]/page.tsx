import { notFound } from "next/navigation";
import { OrganizationPortal, type OrgScreenKey, organizationRouteMap } from "../../../components/organization-portal";

export default async function OrganizationSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const route = section.join("/");
  const screen = organizationRouteMap[route] as OrgScreenKey | undefined;
  if (!screen) notFound();
  return <OrganizationPortal screen={screen} />;
}
