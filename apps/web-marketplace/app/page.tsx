import { SiteHeader } from "../components/site-header";
import { BuyerBrowse } from "../components/buyer-browse";

export default function HomePage() {
  return (
    <>
      <SiteHeader backHref="/auth" backLabel="ورود / ثبت‌نام" />
      <BuyerBrowse />
    </>
  );
}
