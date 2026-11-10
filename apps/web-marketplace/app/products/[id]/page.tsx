import { SiteHeader } from "../../../components/site-header";
import { BuyerProductDetail } from "../../../components/buyer-product-detail";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { FigmaProductDetailPreview } from "../../../components/figma-product-detail-preview";
import { LANDING_PREVIEW_PRODUCTS } from "../../../lib/landing-preview-products";
import {
  buyerBrowseHref, buyerParamsFromRecord, parseBuyerBrowseLocation,
} from "../../../lib/buyer-catalog";

export default async function BuyerProductDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // Only known in-memory design IDs use the preview; UUIDs retain the API-backed path.
  const previewProduct = LANDING_PREVIEW_PRODUCTS.find((product) => product.id === id);
  if (previewProduct) {
    return <><LandingHeader /><FigmaProductDetailPreview key={previewProduct.id} product={previewProduct} /><LandingFooter /></>;
  }
  const backHref = buyerBrowseHref(parseBuyerBrowseLocation(
    buyerParamsFromRecord(await searchParams),
  ));
  return (
    <>
      <SiteHeader backHref={backHref} backLabel="بازگشت به فهرست" />
      <BuyerProductDetail id={id} backHref={backHref} />
    </>
  );
}
