import { notFound, redirect } from "next/navigation";
import { SellerPanelShell } from "../../panel-shell";
import { ScreenFrame } from "../screen-controls";
import { DesignScreen as Screen0 } from "../screens/products";
import { DesignScreen as Screen1 } from "../screens/listing";
import { DesignScreen as Screen2 } from "../screens/inventory";
import { DesignScreen as Screen3 } from "../screens/pricing";
import { DesignScreen as Screen5 } from "../screens/delivery";
import { DesignScreen as Screen6 } from "../screens/settlements";
import { DesignScreen as Screen7 } from "../screens/reports";
import { DesignScreen as Screen8 } from "../screens/notifications";
import { DesignScreen as Screen9 } from "../screens/business";
import { DesignScreen as Screen10 } from "../screens/support";
import { DesignScreen as Screen11 } from "../screens/settings";
import { DesignScreen as Screen12 } from "../screens/states";
import { DesignScreen as Screen13 } from "../screens/images";
import { DesignScreen as Screen14 } from "../screens/order-detail";
const screens={
  "products": Screen0,
  "listing": Screen1,
  "inventory": Screen2,
  "pricing": Screen3,
  "delivery": Screen5,
  "settlements": Screen6,
  "reports": Screen7,
  "notifications": Screen8,
  "business": Screen9,
  "support": Screen10,
  "settings": Screen11,
  "states": Screen12,
  "images": Screen13,
  "order-detail": Screen14
};
const titles = {"products": "کالاها", "listing": "ثبت و ویرایش کالا", "inventory": "موجودی", "pricing": "قیمت\u200cگذاری", "delivery": "ارسال و محدوده فعالیت", "settlements": "تسویه\u200cحساب\u200cها", "reports": "گزارش\u200cها", "notifications": "اعلان\u200cها", "business": "اطلاعات کسب\u200cوکار", "support": "پشتیبانی", "settings": "تنظیمات", "states": "حالت\u200cهای خالی و خطا", "images": "کتابخانه تصاویر", "order-detail": "جزئیات سفارش"};
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{section:string}>}){const {section}=await params;return {title:(titles[section as keyof typeof titles]||"پنل فروشنده")+" | حنا"};}
export default async function SellerPanelSection({params}:{params:Promise<{section:string}>}){
 if(process.env.HANA_AUTH_UI_PREVIEW!=="1")redirect("/seller");
 const {section}=await params;
 // Retire the preview-only Programs screen; old bookmarks remain safe.
 if(section==="programs")redirect("/seller/panel/settlements");
 const Screen=screens[section as keyof typeof screens];if(!Screen)notFound();
 return <SellerPanelShell active={section}><ScreenFrame section={section}><Screen/></ScreenFrame></SellerPanelShell>;
}
