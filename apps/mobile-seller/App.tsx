import { useEffect, useRef, useState } from "react";
import {
  AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, StatusBar, Text, TextInput, View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { useFonts } from "expo-font";
import { Vazirmatn_400Regular, Vazirmatn_700Bold } from "@expo-google-fonts/vazirmatn";
import * as SecureStore from "expo-secure-store";
import { MobileAuthClient } from "../mobile-consumer/src/mobile-auth.ts";
import { normalizeIranianMobile } from "../mobile-consumer/src/phone.ts";
import { validateOtpEntry } from "../mobile-consumer/src/otp-form-input.ts";
import { SellerAccessClient, type SellerIdentity } from "./src/seller-access.ts";
import { SellerOrdersClient, type SellerOrdersResult } from "./src/seller-orders.ts";
import { figmaIcons } from "./src/figma-icons";

const tokenKey = "hana.seller.session.v1";
const previewKey = "hana.seller.preview.v1";
const sellerPreviewAllowed = __DEV__ || process.env.EXPO_PUBLIC_HANA_DEMO_LOGIN === "true";
const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const store = {
  read: () => SecureStore.getItemAsync(tokenKey, secureOptions),
  write: (token: string) => SecureStore.setItemAsync(tokenKey, token, secureOptions),
  remove: () => SecureStore.deleteItemAsync(tokenKey, secureOptions),
};
const apiBase = process.env.EXPO_PUBLIC_HANA_API_BASE_URL;
const auth = new MobileAuthClient(apiBase, store, fetch, Date.now, __DEV__);
const sellerAccess = new SellerAccessClient(apiBase, store, fetch, __DEV__);
const sellerOrders = new SellerOrdersClient(apiBase, store, fetch, __DEV__);
const logo = require("../mobile-consumer/assets/hana-app-logo.png");

type Gate =
  | { kind: "checking" | "guest" | "denied" | "unavailable" | "preview" }
  | { kind: "ready"; seller: SellerIdentity };
type Orders = SellerOrdersResult | { kind: "idle" | "loading" };
const stateLabel: Record<string, string> = {
  PAID: "پرداخت‌شده",
  PREPARING: "در حال آماده‌سازی",
  READY_FOR_PICKUP: "آماده دریافت حضوری",
  COLLECTED: "تحویل‌شده",
  CANCELLED: "لغوشده",
};
const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const rtl = { writingDirection: "rtl" as const, textAlign: "right" as const };
type FigmaIconName = keyof typeof figmaIcons;
function FigmaIcon({ name, size = 20, color = "#706963" }: { name: FigmaIconName; size?: number; color?: string }) {
  const xml = figmaIcons[name].replace(/stroke="[^"]+"/g, `stroke="${color}"`);
  return <SvgXml xml={xml} width={size} height={size} />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Vazirmatn_400Regular, Vazirmatn_700Bold,
  });
  const [gate, setGate] = useState<Gate>({ kind: "checking" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "orders">("dashboard");
  const [previewTab, setPreviewTab] = useState<"dashboard" | "orders" | "products" | "inventory" | "settlements" | "notifications" | "account">("dashboard");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [orders, setOrders] = useState<Orders>({ kind: "idle" });
  const epoch = useRef(0);
  const pending = useRef(false);

  async function refreshGate() {
    const current = ++epoch.current;
    setGate({ kind: "checking" }); // Never show stale private data during revalidation.
    setOrders({ kind: "idle" });
    // A backend-free browser build is a visual product demo, so open the mock
    // seller workspace directly instead of getting stuck at an unavailable API state.
    if (sellerPreviewAllowed && !apiBase && Platform.OS === "web") {
      setGate({ kind: "preview" });
      return;
    }
    if (sellerPreviewAllowed) {
      const flag = await SecureStore.getItemAsync(previewKey, secureOptions).catch(() => null);
      if (current !== epoch.current) return;
      if (flag === "v1") {
        setGate({ kind: "preview" }); // Deliberately no identity, role or orders request.
        return;
      }
    }
    const session = await auth.session();
    if (current !== epoch.current) return;
    if (session.status === "guest") { setGate({ kind: "guest" }); return; }
    if (session.status === "unavailable") {
      setGate({ kind: "unavailable" }); return;
    }
    const access = await sellerAccess.load();
    if (current !== epoch.current) return;
    setGate(access.kind === "ready"
      ? { kind: "ready", seller: access.seller }
      : access.kind === "guest" ? { kind: "guest" }
      : access.kind === "denied" ? { kind: "denied" }
      : { kind: "unavailable" });
  }

  useEffect(() => {
    void refreshGate();
    let previous = AppState.currentState;
    const listener = AppState.addEventListener("change", next => {
      if (previous !== "active" && next === "active") void refreshGate();
      previous = next;
    });
    return () => { epoch.current++; listener.remove(); };
  }, []);

  useEffect(() => {
    if (gate.kind !== "ready" || tab !== "orders" || !gate.seller.capabilities.orders)
      return;
    let live = true;
    setOrders({ kind: "loading" });
    void sellerOrders.load(page).then(result => {
      if (!live) return;
      if (result.kind === "denied" || result.kind === "unauthorized") {
        void refreshGate();
      } else setOrders(result);
    });
    return () => { live = false; };
  }, [gate, tab, page, reload]);

  async function sendOtp() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    const normalized = normalizeIranianMobile(phone);
    setPhone(normalized);
    try {
      const result = await auth.requestOtp(normalized);
      if (result.status === "accepted") {
        setChallengeId(result.challengeId);
        setCode("");
        setOtpStep("code");
      } else setNotice(result.status === "limited"
        ? "تعداد درخواست‌ها زیاد است. بعداً دوباره تلاش کنید."
        : result.status === "invalid" ? "شماره تلفن معتبر نیست."
        : "سرویس پیامک یا ورود در دسترس نیست.");
    } finally { pending.current = false; setBusy(false); }
  }

  async function verifyOtp() {
    if (pending.current || !challengeId) return;
    const checked = validateOtpEntry(code);
    setCode(checked.code);
    if (checked.error) { setNotice(checked.error); return; }
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await auth.verifyOtp(phone, challengeId, checked.code);
      if (result.status === "authenticated") {
        setPhone("");
        setCode("");
        setChallengeId(null);
        setOtpStep("phone");
        await refreshGate();
      } else setNotice(result.status === "invalid"
        ? "کد تأیید معتبر نیست."
        : result.status === "limited" ? "تلاش‌های ورود محدود شده‌اند."
        : "تأیید کد در دسترس نیست؛ دوباره بررسی کنید.");
    } finally { pending.current = false; setBusy(false); }
  }

  async function enterPreview() {
    if (!sellerPreviewAllowed || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await SecureStore.setItemAsync(previewKey, "v1", secureOptions);
      ++epoch.current;
      setGate({ kind: "preview" });
      setNotice("");
    } catch {
      setNotice("ثبت نشست آزمایشی روی دستگاه ممکن نیست.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function signOut() {
    if (pending.current) return;
    // Invalidate any in-flight foreground/session check before revoking the token.
    ++epoch.current;
    pending.current = true;
    setBusy(true);
    setGate({ kind: "checking" });
    setOrders({ kind: "idle" });
    try {
      if (gate.kind === "preview") {
        await SecureStore.deleteItemAsync(previewKey, secureOptions);
        setGate({ kind: "guest" });
        setTab("dashboard");
        setPage(1);
        return;
      }
      const result = await auth.logout();
      setGate(result.status === "signedOut"
        ? { kind: "guest" } : { kind: "unavailable" });
      setTab("dashboard");
      setPage(1);
    } finally { pending.current = false; setBusy(false); }
  }

  const seller = gate.kind === "ready" ? gate.seller : null;

  function dashboard() {
    if (!seller) return null;
    return <View style={styles.body}>
      <Text style={styles.heading}>پیشخوان کسب‌وکار</Text>
      <View style={styles.panel}>
        <Text style={styles.kicker}>فروشنده فعال</Text>
        <Text style={styles.cardTitle}>{seller.storeName}</Text>
        <Text style={styles.muted}>{seller.businessName}</Text>
        <Text style={styles.muted}>کد پیگیری: {seller.trackingCode}</Text>
      </View>
      <Text style={styles.heading}>آمار عملیاتی</Text>
      <View style={styles.metrics}>
        {["سفارش‌های جدید", "در حال انجام", "نیازمند رسیدگی", "کالاها"].map(label =>
          <View key={label} style={styles.metric}>
            <Text style={styles.kicker}>{label}</Text>
            <Text style={styles.metricUnavailable}>—</Text>
          </View>)}
      </View>
      <Text style={styles.hint}>آمار نمونه فیگما نمایش داده نمی‌شود؛ قرارداد آمار تأییدشده هنوز به اپ متصل نیست.</Text>
      <View style={styles.panel}>
        <Text style={styles.heading}>دسترسی سریع عملیاتی</Text>
        <Pressable
          style={seller.capabilities.orders ? styles.action : styles.actionDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !seller.capabilities.orders }}
          disabled={!seller.capabilities.orders}
          onPress={() => { setTab("orders"); setPage(1); }}
        >
          <Text style={styles.actionText}>مشاهده سفارش‌های من</Text>
        </Pressable>
        <Text style={styles.hint}>مدیریت کالا، قیمت و موجودی در پنل وب حنا در دسترس است؛ اتصال بومی این عملیات هنوز تکمیل نشده است.</Text>
      </View>
    </View>;
  }

  function ordersPage() {
    if (!seller) return null;
    return <View style={styles.body}>
      <Text style={styles.heading}>سفارش‌های فروشگاه</Text>
      {!seller.capabilities.orders
        ? <Text style={styles.error}>سرویس سفارش‌های فروشنده فعال نیست.</Text>
        : orders.kind === "loading" || orders.kind === "idle"
          ? <Text style={styles.muted}>در حال دریافت سفارش‌ها…</Text>
          : orders.kind !== "ready"
            ? <View style={styles.panel}>
                <Text style={styles.error}>دریافت سفارش‌ها تأیید نشد. وضعیت نامشخص به معنی فهرست خالی نیست.</Text>
                <Pressable style={styles.action} onPress={() => setReload(value => value + 1)}>
                  <Text style={styles.actionText}>تلاش دوباره</Text>
                </Pressable>
              </View>
            : <>
                {orders.items.length === 0
                  ? <Text style={styles.muted}>در این صفحه سفارشی ثبت نشده است.</Text>
                  : orders.items.map(order => <View key={order.id} style={styles.panel}>
                      <Text style={styles.kicker}>سفارش {order.id}</Text>
                      <Text style={styles.cardTitle}>{stateLabel[order.state]}</Text>
                      <Text style={styles.muted}>{faNumber(order.totalRial)} ریال</Text>
                      <Text style={styles.muted}>{faNumber(order.items.length)} قلم</Text>
                    </View>)}
                <View style={styles.pagination}>
                  <Pressable
                    style={styles.action}
                    disabled={page <= 1}
                    accessibilityState={{ disabled: page <= 1 }}
                    onPress={() => setPage(value => value - 1)}
                  ><Text style={styles.actionText}>قبلی</Text></Pressable>
                  <Text style={styles.muted}>صفحه {faNumber(page)}</Text>
                  <Pressable
                    style={styles.action}
                    disabled={orders.items.length < 20 || page >= 10000}
                    accessibilityState={{ disabled: orders.items.length < 20 || page >= 10000 }}
                    onPress={() => setPage(value => value + 1)}
                  ><Text style={styles.actionText}>بعدی</Text></Pressable>
                </View>
              </>}
    </View>;
  }

  function previewPage() {
    const demoOrders = [
      { id: "HN-۴۰۹۱", title: "روغن آفتابگردان خالص ۱.۵ لیتری (نمونه)", price: "۱۴۲٬۰۰۰", status: "در حال آماده‌سازی", tone: "#F7ECE9" },
      { id: "HN-۴۰۹۰", title: "پنیر سفید ایرانی ممتاز ۴۰۰ گرم (نمونه)", price: "۶۴٬۰۰۰", status: "تأیید شده", tone: "#FFF3D4" },
      { id: "HN-۴۰۸۹", title: "برنج هاشمی درجه یک · ۵ کیلوگرم", price: "۶۸۰٬۰۰۰", status: "تکمیل شده", tone: "#EAF3EC" },
      { id: "HN-۴۰۸۸", title: "عسل طبیعی چندگیاه · ۹۰۰ گرم", price: "۳۱۰٬۰۰۰", status: "آماده تحویل / ارسال", tone: "#F5F1EB" },
      { id: "HN-۴۰۸۷", title: "خرمای مضافتی بم · ۷۰۰ گرم", price: "۵۵۰٬۰۰۰", status: "تکمیل شده", tone: "#EAF3EC" },
    ];
    const products = [
      { title: "ماست سون کاله ۹۰۰ گرم", code: "کد کالا: ۱۰۰۲۴", price: "۸۸٬۰۰۰", stock: "۴۵ عدد", status: "فعال", tone: "#EAF3EC", image: require("./assets/figma-261-3/imgRectangle.jpg") },
      { title: "پنیر سفید ایرانی ممتاز هزار گرمی", code: "کد کالا: ۱۰۰۱۸", price: "۵۴٬۰۰۰", stock: "۲ عدد", status: "رو به اتمام", tone: "#FFF3D4", image: require("./assets/figma-261-3/imgRectangle1.jpg") },
      { title: "روغن زیتون فرابکر", code: "کد کالا: ۱۰۰۳۱", price: "۴۸۵٬۰۰۰", stock: "۲۴ عدد", status: "فعال", tone: "#EAF3EC", image: require("./assets/figma-261-3/imgRectangle.jpg") },
      { title: "خرمای مضافتی بم", code: "کد کالا: ۱۰۰۴۰", price: "۳۷۵٬۰۰۰", stock: "۰ عدد", status: "ناموجود", tone: "#F7ECE9", image: require("./assets/figma-261-3/imgRectangle1.jpg") },
    ];
    const nav = (next: typeof previewTab) => { setPreviewTab(next); setNotice(""); };
    const title = ({ dashboard: "پیشخوان مدیریت حنا", orders: "مدیریت سفارش‌ها", products: "کالاها", inventory: "موجودی و قیمت‌گذاری", settlements: "گزارش‌ها", notifications: "اعلان‌ها", account: "حساب فروشنده" } as const)[previewTab];
    const navItems = [["account", "tabAccount", "حساب"], ["notifications", "tabNotifications", "اعلان‌ها"], ["products", "tabProducts", "کالاها"], ["orders", "tabOrders", "سفارش‌ها"], ["dashboard", "tabHome", "خانه"]] as const;
    return <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.figmaScreen}>
          {previewTab !== "dashboard" && <View style={styles.screenIntro}><Text style={styles.screenTitle}>{title}</Text><Text style={styles.screenCaption}>فروشگاه نمونه · اطلاعات نمایشی</Text></View>}
          {previewTab === "dashboard" && <>
            <View style={styles.metricGrid}>{[["سفارش‌های جدید", "۴ سفارش نمونه", "dashboardOrders", "#B94D35"], ["سفارش‌های در حال انجام", "۸ سفارش نمونه", "dashboardProgress", "#C98543"], ["موارد نیازمند رسیدگی", "۳ مورد نمونه", "dashboardAlert", "#B94D35"], ["کالاهای فعال", "۱۴۲ مورد نمونه", "dashboardProducts", "#204B43"]].map(([label, value, icon, color]) => <View key={label} style={styles.metricCard}><View style={styles.metricCaption}><View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><FigmaIcon name={icon as FigmaIconName} size={13} color={color} /></View><Text style={styles.metricLabel}>{label}</Text></View><Text style={[styles.metricValue, { color }]}>{value}</Text></View>)}</View>
            <View style={styles.quickPanel}><Text style={styles.sectionTitle}>دسترسی سریع عملیاتی</Text><View style={styles.quickGrid}><Pressable style={styles.quickTileAccent} onPress={() => nav("products")}><View style={styles.quickTileContent}><FigmaIcon name="plus" size={14} color="#B5523B"/><Text style={styles.quickTileAccentText}>افزودن کالا</Text></View></Pressable><Pressable style={styles.quickTile} onPress={() => nav("inventory")}><View style={styles.quickTileContent}><FigmaIcon name="quickInventory" size={14}/><Text style={styles.quickTileText}>مدیریت موجودی</Text></View></Pressable><Pressable style={styles.quickTile} onPress={() => nav("inventory")}><View style={styles.quickTileContent}><FigmaIcon name="price" size={14}/><Text style={styles.quickTileText}>ویرایش قیمت‌ها</Text></View></Pressable><Pressable style={styles.quickTile} onPress={() => nav("orders")}><View style={styles.quickTileContent}><FigmaIcon name="orderAction" size={14}/><Text style={styles.quickTileText}>مشاهده سفارش‌ها</Text></View></Pressable></View></View>
            <Text style={styles.sectionTitle}>هشدارهای موجودی / دسترس‌پذیری</Text>
            {[["روغن آفتابگردان خالص ۱.۵ لیتری (نمونه)", "اتمام موجودی", "#F7ECE9", "#B94D35"], ["پنیر سفید ایرانی ممتاز ۴۰۰ گرم (نمونه)", "رو به اتمام", "#FFF3D4", "#9B6A12"]].map(([name, status, bg, color]) => <Pressable key={name} onPress={() => nav("inventory")} style={styles.stockAlert}><Text style={[styles.stockStatus, { backgroundColor: bg, color }]}>{status}</Text><Text style={styles.stockName}>{name}</Text></Pressable>)}
          </>}
          {previewTab === "orders" && <>
            <View style={styles.filterRow}>{["همه", "جدید", "تأیید شده", "در حال آماده‌سازی", "تکمیل شده"].map((f, i) => <Text key={f} style={i === 1 ? styles.filterActive : styles.filterItem}>{f}</Text>)}</View>
            {demoOrders.map((order, i) => <View key={order.id} style={styles.figmaOrder}><View style={styles.figmaOrderHead}><Text style={[styles.orderState, { backgroundColor: order.tone }]}>{order.status}</Text><Text style={styles.previewOrderId}>شماره سفارش: {order.id}</Text></View><View style={styles.figmaDivider}/><Text style={styles.figmaOrderMeta}>زمان ثبت: امروز · { ["۱۰:۲۵", "۱۰:۰۶", "۰۹:۱۵", "۰۸:۴۰", "۱۴:۱۰"][i] }</Text><Text style={styles.figmaOrderMeta}>تعداد اقلام: {faNumber(i + 2)} قلم</Text><Text style={styles.figmaOrderMeta}>شیوه تحویل / ارسال: تحویل حضوری</Text><View style={styles.figmaOrderFoot}><Text style={styles.figmaOrderTotal}>مبلغ: {order.price} تومان</Text><Pressable style={styles.figmaSmallButton} onPress={() => setNotice("جزئیات سفارش نمونه است و به سامانه متصل نیست.")}><Text style={styles.figmaSmallButtonText}>{i === 0 ? "تأیید سفارش" : "مشاهده"}</Text></Pressable></View></View>)}
          </>}
          {previewTab === "products" && <>
            <View style={styles.searchBox}><Text style={styles.searchHint}>جستجو در کالاها...</Text><FigmaIcon name="search" size={18}/></View>
            <View style={styles.filterRow}>{["همه موارد", "کالا", "سایر دسته‌بندی‌ها"].map((f, i) => <Text key={f} style={i === 0 ? styles.filterActive : styles.filterItem}>{f}</Text>)}</View>
            {products.slice(0, 2).map(item => <View key={item.code} style={styles.figmaProduct}><Image source={item.image} style={styles.figmaProductImage} resizeMode="cover"/><View style={styles.productInfo}><View style={styles.productNameRow}><Text style={styles.productName}>{item.title}</Text><Text style={[styles.productStatus, { backgroundColor: item.tone }]}>{item.status}</Text></View><Text style={styles.previewOrderDate}>دسته‌بندی: لبنیات · موجودی: {item.stock}</Text><Text style={styles.productPrice}>{item.price} تومان</Text></View><Pressable style={styles.editProduct} onPress={() => setNotice("ویرایش کالا در پیش‌نمایش نمایشی است.")}><FigmaIcon name="edit" size={15} color="#2D2D2D"/></Pressable></View>)}
            <Pressable style={styles.figmaPrimaryButton} onPress={() => setNotice("فرم ثبت کالای جدید در این پیش‌نمایش نمایشی است.")}><Text style={styles.primaryActionText}>＋  افزودن کالای جدید</Text></Pressable>
          </>}
          {previewTab === "inventory" && <><View style={styles.accountCard}><Text style={styles.sectionTitle}>موجودی و قیمت‌گذاری کالاها</Text><Text style={styles.infoText}>مقادیر برای نمایش رابط کاربری نمونه هستند.</Text></View>{products.map(item => <View key={item.code} style={styles.inventoryCard}><View style={styles.inventoryHead}><Text style={styles.productStatus}>{item.stock}</Text><Text style={styles.productName}>{item.title}</Text></View><Text style={styles.previewOrderDate}>{item.code} · قیمت فعلی: {item.price} تومان</Text><View style={styles.inventoryActions}><Pressable style={styles.smallAction} onPress={() => setNotice("تغییر موجودی در این پیش‌نمایش نمایشی است.")}><Text style={styles.smallActionText}>تغییر موجودی</Text></Pressable><Pressable style={styles.smallAction} onPress={() => setNotice("تغییر قیمت در این پیش‌نمایش نمایشی است.")}><Text style={styles.smallActionText}>ویرایش قیمت</Text></Pressable></View></View>)}</>}
          {previewTab === "settlements" && <><View style={styles.accountCard}><Text style={styles.sectionTitle}>خلاصهٔ مالی</Text></View>{[["در انتظار تسویه", "۱۸٬۴۰۰٬۰۰۰ تومان"], ["تسویه‌شده", "۱۰۶٬۴۶۰٬۰۰۰ تومان"], ["سفارش‌های تکمیل‌شده", "۲۳ سفارش"]].map(([label, value]) => <View key={label} style={styles.financeRow}><Text style={styles.financeValue}>{value}</Text><Text style={styles.productName}>{label}</Text></View>)}</>}
          {previewTab === "notifications" && <>{[["سفارش جدید دریافت شد", "سفارش HN-۴۰۹۱ ثبت شده و در انتظار تأیید شماست.", "۱۰:۲۵", "#F7ECE9"], ["موجودی کالا رو به اتمام است", "موجودی پنیر سفید به ۲ عدد رسیده است.", "دیروز · ۱۷:۴۰", "#FFF3D4"], ["تسویه با موفقیت انجام شد", "مبلغ ۱۲٬۶۰۰٬۰۰۰ تومان واریز شد.", "دیروز · ۱۲:۱۵", "#EAF3EC"]].map(([heading, body, time, color]) => <View key={heading} style={styles.notificationCard}><View style={[styles.notificationIcon, { backgroundColor: color }]}><Text style={styles.quickActionIcon}>•</Text></View><View style={styles.notificationContent}><Text style={styles.productName}>{heading}</Text><Text style={styles.infoText}>{body}</Text><Text style={styles.previewOrderDate}>{time}</Text></View></View>)}</>}
          {previewTab === "account" && <><View style={styles.accountCard}><Text style={styles.sectionTitle}>حساب کسب‌وکار</Text><View style={styles.accountLine}><Text style={styles.accountValue}>خلاصه حساب نمونه</Text><Text style={styles.accountLabel}>فروشنده نمونه</Text></View></View><View style={styles.accountCard}><Text style={styles.sectionTitle}>اطلاعات هویتی</Text>{[["نوع حساب", "شخص حقیقی"], ["وضعیت احراز هویت", "تأیید شده"], ["وضعیت فروشندگی", "فعال"], ["وضعیت حمایتی مرتبط", "شناسایی شده"]].map(([l, v]) => <View style={styles.accountLine} key={l}><Text style={styles.accountValue}>{v}</Text><Text style={styles.accountLabel}>{l}</Text></View>)}</View><View style={styles.accountLinks}>{[["اطلاعات کسب‌وکار", "نام، آدرس، صنف"], ["موجودی و دسترس‌پذیری", "وضعیت کالاها"], ["قیمت‌گذاری", "قیمت کالاها"], ["ارسال و محدوده فعالیت", "روش و محدوده ارسال"], ["طرح‌ها و اعتبارها", "طرح‌ها و اعتبارها"], ["تسویه‌حساب‌ها", "اطلاعات تسویه"], ["گزارش‌ها", "فروش و عملکرد"], ["پشتیبانی", "گفتگو و تیکت"], ["تنظیمات", "زبان، اعلان‌ها"]].map(([l, h]) => <Pressable key={l} style={styles.accountLink} onPress={() => nav(l.includes("تسویه") || l.includes("گزارش") ? "settlements" : "inventory")}><Text style={styles.accountChevron}>‹</Text><Text style={styles.accountValue}>{h}</Text><Text style={styles.accountLabel}>{l}</Text></Pressable>)}</View><Pressable style={styles.outlineAction} onPress={() => void signOut()}><Text style={styles.outlineActionText}>خروج از حساب</Text></Pressable></>}
          {notice ? <Pressable onPress={() => setNotice("")} style={styles.noticeBox}><Text style={styles.noticeText}>{notice}  ×</Text></Pressable> : null}
        </View>
      </ScrollView>
      <View style={styles.figmaBottomNav}>{navItems.map(([key, icon, label]) => <Pressable key={key} onPress={() => nav(key)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: previewTab === key }} style={styles.figmaNavItem}><FigmaIcon name={icon as FigmaIconName} size={20} color={previewTab === key ? "#B5523B" : "#706963"}/><Text style={previewTab === key ? styles.figmaNavLabelActive : styles.figmaNavLabel}>{label}</Text></Pressable>)}<View style={styles.gesturePill}/></View>
    </>;
  }

  return <SafeAreaProvider>
    <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" translucent={false} />
    <SafeAreaView style={styles.root}>
      {!fontsLoaded && !fontError ? <Text style={styles.muted}>در حال آماده‌سازی…</Text> : <>
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <View style={styles.brand}>
            <Text style={styles.heading}>{gate.kind === "preview" ? ({ dashboard: "پیشخوان مدیریت حنا", orders: "مدیریت سفارش‌ها", products: "کالاها", inventory: "موجودی کالاها", settlements: "تسویه‌حساب‌ها", notifications: "اعلان‌ها", account: "حساب فروشنده" } as const)[previewTab] : "پیشخوان فروشنده حنا"}</Text>
            <Text style={styles.muted}>{gate.kind === "preview" ? "کسب‌وکار نمونه" : seller?.storeName ?? "ورود امن فروشنده"}</Text>
          </View>
          {gate.kind === "preview" ? <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>م</Text></View> : null}
        </View>
        {gate.kind === "ready" ? <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {tab === "dashboard" ? dashboard() : ordersPage()}
          </ScrollView>
          <View style={styles.bottomNav}>
            <Pressable onPress={() => setTab("dashboard")} style={styles.navItem} accessibilityRole="button">
              <Text style={tab === "dashboard" ? styles.navSelected : styles.navLabel}>پیشخوان</Text>
            </Pressable>
            <Pressable onPress={() => { setTab("orders"); setPage(1); }} style={styles.navItem} accessibilityRole="button">
              <Text style={tab === "orders" ? styles.navSelected : styles.navLabel}>سفارش‌ها</Text>
            </Pressable>
            <View style={styles.navItem}><Text style={styles.navDisabled}>کالاها</Text></View>
            <View style={styles.navItem}><Text style={styles.navDisabled}>اعلان‌ها</Text></View>
            <Pressable onPress={() => void signOut()} style={styles.navItem} disabled={busy}>
              <Text style={styles.navLabel}>خروج</Text>
            </Pressable>
          </View>
        </> : gate.kind === "preview" ? previewPage() : <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.gateBody} keyboardShouldPersistTaps="handled">
            {gate.kind === "checking" ? <Text style={styles.muted}>در حال تأیید نشست و دسترسی فروشنده…</Text>
              : gate.kind === "denied" ? <>
                  <Text style={styles.error}>این حساب دسترسی فروشندگی فعال و تأییدشده ندارد.</Text>
                  <Text style={styles.muted}>ثبت‌نام یا فعال‌سازی را در پنل وب فروشنده پیگیری کنید.</Text>
                  <Pressable style={styles.action} onPress={() => void signOut()} disabled={busy}>
                    <Text style={styles.actionText}>خروج از حساب</Text>
                  </Pressable>
                </>
              : gate.kind === "unavailable" ? <>
                  <Text style={styles.error}>وضعیت نشست یا دسترسی فروشنده قابل تأیید نیست.</Text>
                  <Pressable style={styles.action} onPress={() => void refreshGate()}>
                    <Text style={styles.actionText}>بررسی دوباره</Text>
                  </Pressable>
                </>
              : <>
                  <Text style={styles.heading}>ورود به حساب فروشنده</Text>
                  {sellerPreviewAllowed && <>
                    <Text style={styles.muted}>برای بررسی ظاهری اپ، بدون شماره تلفن وارد پیش‌نمایش شوید؛ به داده‌های واقعی دسترسی ندارید.</Text>
                    <Pressable accessibilityRole="button"
                      accessibilityLabel="ورود آزمایشی فروشنده بدون پیامک"
                      style={styles.action} disabled={busy}
                      onPress={() => void enterPreview()}>
                      <Text style={styles.actionText}>ورود آزمایشی فروشنده بدون پیامک</Text>
                    </Pressable>
                  </>}
                  {!sellerPreviewAllowed && (otpStep === "phone" ? <>
                    <TextInput
                      style={styles.input}
                      placeholder="شماره موبایل ۰۹..."
                      keyboardType="phone-pad"
                      textAlign="right"
                      value={phone}
                      editable={!busy}
                      onChangeText={setPhone}
                      maxLength={14}
                    />
                    <Pressable style={styles.action} disabled={busy} onPress={() => void sendOtp()}>
                      <Text style={styles.actionText}>دریافت کد تأیید</Text>
                    </Pressable>
                  </> : <>
                    <Text style={styles.muted}>کد شش‌رقمی ارسال‌شده را وارد کنید.</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="کد تأیید"
                      keyboardType="number-pad"
                      textAlign="center"
                      value={code}
                      editable={!busy}
                      onChangeText={setCode}
                      maxLength={6}
                    />
                    <Pressable style={styles.action} disabled={busy} onPress={() => void verifyOtp()}>
                      <Text style={styles.actionText}>تأیید و ورود</Text>
                    </Pressable>
                    <Pressable onPress={() => { setOtpStep("phone"); setCode(""); setChallengeId(null); setNotice(""); }}>
                      <Text style={styles.muted}>تغییر شماره / دریافت کد جدید</Text>
                    </Pressable>
                  </>)}
                  {notice ? <Text style={styles.error} accessibilityRole="alert">{notice}</Text> : null}
                </>}
          </ScrollView>
        </KeyboardAvoidingView>}
      </>}
    </SafeAreaView>
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", maxWidth: 390, maxHeight: 880, alignSelf: "center", backgroundColor: "#FAF8F5", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#EEE9E3" },
  flex: { flex: 1 },
  header: {
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#EAE6E1",
    paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row-reverse",
    alignItems: "center", gap: 8,
  },
  logo: { width: 45, height: 36 },
  brand: { flex: 1, alignItems: "flex-end" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  body: { padding: 16, gap: 14 },
  gateBody: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 },
  heading: {
    fontFamily: "Vazirmatn_700Bold", fontSize: 16, color: "#1C3F3A", ...rtl,
  },
  cardTitle: {
    fontFamily: "Vazirmatn_700Bold", fontSize: 17, color: "#2D2D2D", ...rtl,
  },
  kicker: { fontFamily: "Vazirmatn_400Regular", fontSize: 12, color: "#706963", ...rtl },
  muted: { fontFamily: "Vazirmatn_400Regular", fontSize: 13, color: "#706963", ...rtl },
  hint: { fontFamily: "Vazirmatn_400Regular", fontSize: 12, color: "#756D65", ...rtl },
  error: { fontFamily: "Vazirmatn_400Regular", fontSize: 14, color: "#A33E30", ...rtl },
  panel: {
    backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16,
    borderColor: "#EAE6E1", borderWidth: 1, gap: 10,
  },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  metric: {
    width: "48%", minHeight: 96, padding: 12, borderRadius: 12, gap: 8,
    backgroundColor: "#FFFFFF", borderColor: "#EAE6E1", borderWidth: 1,
    alignItems: "flex-end",
  },
  metricUnavailable: { fontSize: 20, color: "#B5523B", fontFamily: "Vazirmatn_700Bold" },
  action: {
    backgroundColor: "#B5523B", paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 10, alignItems: "center",
  },
  actionDisabled: {
    backgroundColor: "#EAE6E1", paddingVertical: 12,
    paddingHorizontal: 14, borderRadius: 10, alignItems: "center",
  },
  actionText: { fontFamily: "Vazirmatn_700Bold", fontSize: 13, color: "#FFFFFF" },
  input: {
    borderColor: "#D7B895", backgroundColor: "#FFFFFF", borderWidth: 1,
    borderRadius: 10, padding: 12, fontFamily: "Vazirmatn_400Regular",
    fontSize: 16, color: "#2D2D2D",
  },
  pagination: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
  },
  bottomNav: {
    backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE6E1",
    flexDirection: "row-reverse", justifyContent: "space-around", paddingVertical: 14,
  },
  navItem: { alignItems: "center", justifyContent: "center", minWidth: 56 },
  navSelected: { color: "#B5523B", fontFamily: "Vazirmatn_700Bold", fontSize: 11 },
  navLabel: { color: "#706963", fontFamily: "Vazirmatn_400Regular", fontSize: 11 },
  navDisabled: { color: "#BDB8B4", fontFamily: "Vazirmatn_400Regular", fontSize: 11 },
  previewBody: { padding: 16, gap: 14, maxWidth: 720, width: "100%", alignSelf: "center" },
  previewTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewLogout: { color: "#A33E30", fontFamily: "Vazirmatn_700Bold", fontSize: 12 },
  previewDate: { color: "#8A8178", fontFamily: "Vazirmatn_400Regular", fontSize: 11, ...rtl },
  livePill: { backgroundColor: "#EAF5EF", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#407764" },
  liveText: { color: "#407764", fontFamily: "Vazirmatn_700Bold", fontSize: 10 },
  previewTitle: { color: "#1C3F3A", fontFamily: "Vazirmatn_700Bold", fontSize: 20, ...rtl },
  previewSubtitle: { color: "#706963", fontFamily: "Vazirmatn_400Regular", fontSize: 12, marginTop: -9, ...rtl },
  revenueCard: { backgroundColor: "#1C3F3A", borderRadius: 18, padding: 18, gap: 7, overflow: "hidden" },
  revenueLabel: { color: "#D7E6DE", fontFamily: "Vazirmatn_400Regular", fontSize: 12, ...rtl },
  revenueValue: { color: "#FFFFFF", fontFamily: "Vazirmatn_700Bold", fontSize: 24, ...rtl },
  revenueUnit: { color: "#D7E6DE", fontFamily: "Vazirmatn_400Regular", fontSize: 11 },
  revenueChange: { color: "#B9D8C4", fontFamily: "Vazirmatn_400Regular", fontSize: 11, ...rtl },
  sparkline: { height: 56, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 7, marginTop: 5 },
  sparkBar: { flex: 1, maxHeight: 48, borderRadius: 4, backgroundColor: "#8DB8A1", opacity: 0.85 },
  previewMetrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, justifyContent: "space-between" },
  previewMetric: { backgroundColor: "#FFFFFF", borderRadius: 13, padding: 12, width: "48%", minHeight: 78, borderWidth: 1, borderColor: "#EEE9E3", justifyContent: "space-between", alignItems: "flex-end" },
  previewMetricValue: { fontFamily: "Vazirmatn_700Bold", fontSize: 22 },
  previewMetricLabel: { color: "#706963", fontFamily: "Vazirmatn_400Regular", fontSize: 11, ...rtl },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { color: "#283B35", fontFamily: "Vazirmatn_700Bold", fontSize: 15, ...rtl },
  sectionAction: { color: "#B5523B", fontFamily: "Vazirmatn_700Bold", fontSize: 11 },
  previewOrder: { backgroundColor: "#FFFFFF", borderRadius: 14, borderColor: "#EEE9E3", borderWidth: 1, padding: 13, gap: 8 },
  previewOrderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewOrderPrice: { color: "#1C3F3A", fontFamily: "Vazirmatn_700Bold", fontSize: 11, ...rtl },
  previewOrderId: { color: "#837A72", fontFamily: "Vazirmatn_400Regular", fontSize: 10, ...rtl },
  previewOrderName: { color: "#2D2D2D", fontFamily: "Vazirmatn_700Bold", fontSize: 13, ...rtl },
  previewOrderBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewOrderDate: { color: "#8A8178", fontFamily: "Vazirmatn_400Regular", fontSize: 10, ...rtl },
  statusPill: { color: "#5C554E", fontFamily: "Vazirmatn_700Bold", fontSize: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, overflow: "hidden" },
  quickActions: { flexDirection: "row-reverse", gap: 10 },
  quickAction: { flex: 1, minHeight: 68, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEE9E3", alignItems: "center", justifyContent: "center", gap: 4 },
  quickActionIcon: { color: "#B5523B", fontFamily: "Vazirmatn_700Bold", fontSize: 21, lineHeight: 25 },
  quickActionText: { color: "#554F48", fontFamily: "Vazirmatn_700Bold", fontSize: 10 },
  filterRow: { flexDirection: "row-reverse", gap: 8, marginVertical: 2 },
  filterActive: { overflow: "hidden", backgroundColor: "#1C3F3A", color: "#FFFFFF", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, fontFamily: "Vazirmatn_700Bold", fontSize: 10 },
  filterItem: { overflow: "hidden", backgroundColor: "#FFFFFF", color: "#706963", borderColor: "#EAE6E1", borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, fontFamily: "Vazirmatn_400Regular", fontSize: 10 },
  outlineAction: { borderWidth: 1, borderColor: "#B5523B", borderRadius: 9, paddingVertical: 8, alignItems: "center" },
  outlineActionText: { color: "#B5523B", fontFamily: "Vazirmatn_700Bold", fontSize: 11 },
  primaryAction: { backgroundColor: "#B5523B", borderRadius: 11, paddingVertical: 12, alignItems: "center" },
  primaryActionText: { color: "#FFFFFF", fontFamily: "Vazirmatn_700Bold", fontSize: 12 },
  productCard: { backgroundColor: "#FFFFFF", borderRadius: 13, borderWidth: 1, borderColor: "#EEE9E3", padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  productSwatch: { width: 48, height: 48, borderRadius: 11, backgroundColor: "#F4EFE8", justifyContent: "center", alignItems: "center" },
  productEmoji: { color: "#B5523B", fontFamily: "Vazirmatn_700Bold", fontSize: 22 },
  productInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
  productName: { color: "#2D2D2D", fontFamily: "Vazirmatn_700Bold", fontSize: 12, ...rtl },
  productPrice: { color: "#1C3F3A", fontFamily: "Vazirmatn_700Bold", fontSize: 11, ...rtl },
  productStatus: { color: "#407764", fontFamily: "Vazirmatn_700Bold", fontSize: 9, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, overflow: "hidden", ...rtl },
  infoBanner: { borderRadius: 11, backgroundColor: "#F3F0EA", padding: 11 },
  infoText: { color: "#706963", fontFamily: "Vazirmatn_400Regular", fontSize: 10, ...rtl },
  inventoryCard: { backgroundColor: "#FFFFFF", borderRadius: 13, borderWidth: 1, borderColor: "#EEE9E3", padding: 13, gap: 9 },
  inventoryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inventoryActions: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" },
  smallAction: { backgroundColor: "#F5F1EB", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  smallActionText: { color: "#554F48", fontFamily: "Vazirmatn_700Bold", fontSize: 9 },
  discountTag: { color: "#A33E30", fontFamily: "Vazirmatn_700Bold", fontSize: 9, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "#FCECE8", borderRadius: 8 },
  financeRow: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#EEE9E3", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  financeValue: { fontFamily: "Vazirmatn_700Bold", fontSize: 11 },
  notificationCard: { backgroundColor: "#FFFFFF", borderRadius: 13, padding: 13, borderWidth: 1, borderColor: "#EEE9E3", flexDirection: "row-reverse", gap: 11 },
  notificationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  notificationContent: { flex: 1, alignItems: "flex-end", gap: 5 },
  noticeBox: { backgroundColor: "#FFF2E7", borderRadius: 10, padding: 10 },
  noticeText: { color: "#815B39", fontFamily: "Vazirmatn_400Regular", fontSize: 11, ...rtl },
  figmaScreen: { width: "100%", maxWidth: 520, alignSelf: "center", padding: 16, paddingBottom: 26, gap: 12 },
  profileAvatar: { width: 38, height: 38, borderRadius: 22, backgroundColor: "#F7ECE9", alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: "#B94D35", fontFamily: "Vazirmatn_700Bold", fontSize: 15 },
  screenIntro: { gap: 3, marginBottom: 3 },
  screenTitle: { fontFamily: "Vazirmatn_700Bold", fontSize: 17, color: "#204B43", ...rtl },
  screenCaption: { fontFamily: "Vazirmatn_400Regular", fontSize: 11, color: "#817970", ...rtl },
  metricGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  metricCard: { width: "48%", minHeight: 98, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#EAE5DF", padding: 11, justifyContent: "space-between", gap: 8 },
  metricCaption: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  metricIcon: { width: 24, height: 24, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metricLabel: { flex: 1, fontFamily: "Vazirmatn_400Regular", fontSize: 10, color: "#827970", ...rtl },
  metricValue: { fontFamily: "Vazirmatn_700Bold", fontSize: 18, ...rtl },
  quickPanel: { backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: "#EAE5DF", padding: 14, gap: 12 },
  quickGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  quickTile: { width: "48%", height: 44, borderRadius: 11, backgroundColor: "#F8F6F3", alignItems: "center", justifyContent: "center" },
  quickTileAccent: { width: "48%", height: 44, borderRadius: 11, backgroundColor: "#F8ECE9", alignItems: "center", justifyContent: "center" },
  quickTileText: { fontFamily: "Vazirmatn_700Bold", color: "#4D4A46", fontSize: 11 },
  quickTileAccentText: { fontFamily: "Vazirmatn_700Bold", color: "#B94D35", fontSize: 11 },
  quickTileContent: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  stockAlert: { minHeight: 50, backgroundColor: "#FFFFFF", borderColor: "#EAE5DF", borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  stockStatus: { overflow: "hidden", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, fontFamily: "Vazirmatn_700Bold", fontSize: 9 },
  stockName: { flex: 1, color: "#393632", fontFamily: "Vazirmatn_400Regular", fontSize: 11, ...rtl },
  figmaBottomNav: { backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE5DF", flexDirection: "row", justifyContent: "space-around", paddingTop: 8, paddingBottom: 18, position: "relative" },
  gesturePill: { position: "absolute", bottom: 3, alignSelf: "center", width: 108, height: 4, borderRadius: 4, backgroundColor: "#292929" },
  figmaNavItem: { minWidth: 55, alignItems: "center", justifyContent: "center", gap: 2 },
  figmaNavIcon: { color: "#827A72", fontSize: 19, lineHeight: 23 },
  figmaNavIconActive: { color: "#BC4E36", fontSize: 19, lineHeight: 23 },
  figmaNavLabel: { color: "#817970", fontFamily: "Vazirmatn_400Regular", fontSize: 9 },
  figmaNavLabelActive: { color: "#BC4E36", fontFamily: "Vazirmatn_700Bold", fontSize: 9 },
  searchBox: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE5DF", borderRadius: 11, height: 46, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  searchHint: { color: "#827970", fontFamily: "Vazirmatn_400Regular", fontSize: 12, ...rtl },
  searchGlyph: { fontSize: 22, color: "#766F68" },
  figmaProduct: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE5DF", borderRadius: 15, padding: 11, minHeight: 100, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  figmaProductImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#F4F0EB" },
  productNameRow: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: 5 },
  editProduct: { width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderColor: "#EAE5DF", alignItems: "center", justifyContent: "center" },
  figmaPrimaryButton: { backgroundColor: "#B94D35", borderRadius: 28, minHeight: 46, paddingHorizontal: 20, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 5 },
  figmaOrder: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE5DF", borderRadius: 14, padding: 11, gap: 4 },
  figmaOrderHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  orderState: { fontFamily: "Vazirmatn_700Bold", fontSize: 9, color: "#665D55", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4, overflow: "hidden" },
  figmaDivider: { height: 1, backgroundColor: "#EEEAE5", marginVertical: 2 },
  figmaOrderMeta: { fontFamily: "Vazirmatn_400Regular", fontSize: 10, color: "#716A63", ...rtl },
  figmaOrderFoot: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  figmaOrderTotal: { color: "#383531", fontFamily: "Vazirmatn_700Bold", fontSize: 11, ...rtl },
  figmaSmallButton: { backgroundColor: "#B94D35", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  figmaSmallButtonText: { color: "#FFFFFF", fontFamily: "Vazirmatn_700Bold", fontSize: 9 },
  accountCard: { backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#EAE5DF", padding: 14, gap: 12 },
  accountLine: { flexDirection: "row-reverse", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#EEEAE5", paddingTop: 10 },
  accountValue: { fontFamily: "Vazirmatn_400Regular", fontSize: 10, color: "#746D66", ...rtl },
  accountLabel: { fontFamily: "Vazirmatn_400Regular", fontSize: 10, color: "#746D66", ...rtl },
  accountLinks: { borderRadius: 15, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE5DF" },
  accountLink: { minHeight: 48, flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: "#EEEAE5" },
  accountChevron: { color: "#777069", fontSize: 20 },
});
