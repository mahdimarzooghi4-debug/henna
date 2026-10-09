import { SiteHeader } from "../../../components/site-header";
import { BuyerOrders } from "../../../components/buyer-orders";
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <><SiteHeader commerce backHref="/orders" backLabel="سفارش‌های من"/><BuyerOrders id={id}/></>; }
