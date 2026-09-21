import { SiteHeader } from "../../../components/site-header";
import { BuyerProductDetail } from "../../../components/buyer-product-detail";

export default async function BuyerProductDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader backHref="/" backLabel="بازگشت به فهرست" />
      <BuyerProductDetail id={id} />
    </>
  );
}
