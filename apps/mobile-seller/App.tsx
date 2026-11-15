import { useEffect, useRef, useState } from "react";
import {
  AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, StatusBar, Text, TextInput, View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Vazirmatn_400Regular, Vazirmatn_700Bold } from "@expo-google-fonts/vazirmatn";
import * as SecureStore from "expo-secure-store";
import { MobileAuthClient } from "../mobile-consumer/src/mobile-auth.ts";
import { normalizeIranianMobile } from "../mobile-consumer/src/phone.ts";
import { validateOtpEntry } from "../mobile-consumer/src/otp-form-input.ts";
import { SellerAccessClient, type SellerIdentity } from "./src/seller-access.ts";
import { SellerOrdersClient, type SellerOrdersResult } from "./src/seller-orders.ts";

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
  const [previewTab, setPreviewTab] = useState<"dashboard" | "orders" | "products" | "inventory" | "settlements" | "notifications">("dashboard");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [orders, setOrders] = useState<Orders>({ kind: "idle" });
  const epoch = useRef(0);
  const pending = useRef(false);

  async function refreshGate() {
    const current = ++epoch.current;
    setGate({ kind: "checking" }); // Never show stale private data during revalidation.
    setOrders({ kind: "idle" });
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
        {["سفارش‌های جدید", "در حال انجام", "نیازمند رسیدگی", "کالاها / خدمات"].map(label =>
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
      { id: "HN-۱۴۰۵-۲۴۸۱", title: "روغن زیتون فرابکر ۵۰۰ میلی‌لیتر", price: "۴۸۵٬۰۰۰", status: "در حال آماده‌سازی", tone: "#FFF2E7" },
      { id: "HN-۱۴۰۵-۲۴۷۹", title: "برنج هاشمی درجه یک · ۵ کیلوگرم", price: "۱٬۲۸۰٬۰۰۰", status: "آماده تحویل", tone: "#EAF5EF" },
      { id: "HN-۱۴۰۵-۲۴۷۴", title: "عسل طبیعی چندگیاه · ۹۰۰ گرم", price: "۶۹۰٬۰۰۰", status: "تحویل‌شده", tone: "#F2EEFA" },
    ];
    const products = [
      { title: "روغن زیتون فرابکر", code: "کد کالا: ۱۰۰۲۴", price: "۴۸۵٬۰۰۰", stock: "۲۴ عدد", status: "فعال", tone: "#EAF5EF" },
      { title: "برنج هاشمی درجه یک", code: "کد کالا: ۱۰۰۱۸", price: "۱٬۲۸۰٬۰۰۰", stock: "۸ عدد", status: "موجودی کم", tone: "#FFF2E7" },
      { title: "عسل طبیعی چندگیاه", code: "کد کالا: ۱۰۰۳۱", price: "۶۹۰٬۰۰۰", stock: "۱۶ عدد", status: "فعال", tone: "#EAF5EF" },
      { title: "خرمای مضافتی بم", code: "کد کالا: ۱۰۰۴۰", price: "۳۷۵٬۰۰۰", stock: "۰ عدد", status: "ناموجود", tone: "#FCECE8" },
    ];
    const nav = (next: typeof previewTab) => setPreviewTab(next);
    const title = ({ dashboard: "پیشخوان فروشگاه", orders: "مدیریت سفارش‌ها", products: "کالاهای فروشگاه", inventory: "موجودی و قیمت‌گذاری", settlements: "گزارش فروش و تسویه", notifications: "اعلان‌ها" } as const)[previewTab];
    return <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewBody}>
          <View style={styles.previewTopline}>
            <Pressable onPress={() => void signOut()}><Text style={styles.previewLogout}>خروج</Text></Pressable>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>فروشگاه فعال</Text></View>
            <Text style={styles.previewDate}>شنبه، ۲۴ آبان ۱۴۰۵</Text>
          </View>
          <Text style={styles.previewTitle}>{title}</Text>
          <Text style={styles.previewSubtitle}>فروشگاه خانهٔ خوراک · داده‌های نمونه برای نمایش اپ</Text>
          {previewTab === "dashboard" && <>
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>فروش امروز</Text>
              <Text style={styles.revenueValue}>۸٬۴۲۵٬۰۰۰ <Text style={styles.revenueUnit}>ریال</Text></Text>
              <Text style={styles.revenueChange}>↑ ۱۲٪ بیشتر از روز گذشته</Text>
              <View style={styles.sparkline}>{[24, 34, 29, 46, 39, 55, 49, 68, 57, 79, 65, 92].map((h, i) => <View key={i} style={[styles.sparkBar, { height: h }]} />)}</View>
            </View>
            <View style={styles.previewMetrics}>
              {[["سفارش جدید", "۰۶", "#B5523B"], ["در انتظار آماده‌سازی", "۰۳", "#C98035"], ["کالای فعال", "۲۸", "#407764"], ["موجودی کم", "۰۲", "#A33E30"]].map(([label, value, color]) => <View key={label} style={styles.previewMetric}><Text style={[styles.previewMetricValue, { color }]}>{value}</Text><Text style={styles.previewMetricLabel}>{label}</Text></View>)}
            </View>
            <View style={styles.sectionHead}><Text style={styles.sectionAction} onPress={() => nav("orders")}>مشاهده همه</Text><Text style={styles.sectionTitle}>سفارش‌های اخیر</Text></View>
            {demoOrders.slice(0, 2).map(order => <View key={order.id} style={styles.previewOrder}><View style={styles.previewOrderTop}><Text style={styles.previewOrderPrice}>{order.price} ریال</Text><Text style={styles.previewOrderId}>{order.id}</Text></View><Text style={styles.previewOrderName}>{order.title}</Text><View style={styles.previewOrderBottom}><Text style={[styles.statusPill, { backgroundColor: order.tone }]}>{order.status}</Text><Text style={styles.previewOrderDate}>امروز · ۱۰:۲۵</Text></View></View>)}
            <View style={styles.quickActions}><Pressable style={styles.quickAction} onPress={() => nav("products")}><Text style={styles.quickActionIcon}>＋</Text><Text style={styles.quickActionText}>افزودن کالا</Text></Pressable><Pressable style={styles.quickAction} onPress={() => nav("inventory")}><Text style={styles.quickActionIcon}>↗</Text><Text style={styles.quickActionText}>به‌روزرسانی موجودی</Text></Pressable></View>
          </>}
          {previewTab === "orders" && <>
            <View style={styles.filterRow}>{["همهٔ سفارش‌ها", "جدید", "در حال انجام"].map((f, i) => <Text key={f} style={i === 0 ? styles.filterActive : styles.filterItem}>{f}</Text>)}</View>
            {demoOrders.map((order, i) => <View key={order.id} style={styles.previewOrder}><View style={styles.previewOrderTop}><Text style={styles.previewOrderPrice}>{order.price} ریال</Text><Text style={styles.previewOrderId}>{order.id}</Text></View><Text style={styles.previewOrderName}>{order.title}</Text><View style={styles.previewOrderBottom}><Text style={[styles.statusPill, { backgroundColor: order.tone }]}>{order.status}</Text><Text style={styles.previewOrderDate}>{["امروز · ۱۰:۲۵", "امروز · ۰۹:۴۰", "دیروز · ۱۸:۱۰"][i]}</Text></View>{i < 2 && <Pressable style={styles.outlineAction} onPress={() => setNotice("وضعیت سفارش در این پیش‌نمایش نمایشی است.")}><Text style={styles.outlineActionText}>{i === 0 ? "تأیید و آماده‌سازی" : "جزئیات سفارش"}</Text></Pressable>}</View>)}
          </>}
          {previewTab === "products" && <>
            <Pressable style={styles.primaryAction} onPress={() => setNotice("فرم افزودن کالا در نسخهٔ نمایشی به سرور متصل نیست.")}><Text style={styles.primaryActionText}>＋  افزودن کالای جدید</Text></Pressable>
            {products.map(item => <View key={item.code} style={styles.productCard}><View style={styles.productSwatch}><Text style={styles.productEmoji}>▧</Text></View><View style={styles.productInfo}><Text style={styles.productName}>{item.title}</Text><Text style={styles.previewOrderDate}>{item.code} · {item.stock}</Text><Text style={styles.productPrice}>{item.price} ریال</Text></View><Text style={[styles.productStatus, { backgroundColor: item.tone }]}>{item.status}</Text></View>)}
          </>}
          {previewTab === "inventory" && <>
            <View style={styles.infoBanner}><Text style={styles.infoText}>موجودی یا قیمت را انتخاب کنید تا تغییرات نمونه را ببینید.</Text></View>
            {products.map((item, i) => <View key={item.code} style={styles.inventoryCard}><View style={styles.inventoryHead}><Text style={styles.productStatus}>{item.stock}</Text><Text style={styles.productName}>{item.title}</Text></View><Text style={styles.previewOrderDate}>{item.code} · قیمت فعلی: {item.price} ریال</Text><View style={styles.inventoryActions}><Pressable style={styles.smallAction} onPress={() => setNotice(`ویرایش موجودی «${item.title}» در پیش‌نمایش شبیه‌سازی شد.`)}><Text style={styles.smallActionText}>تغییر موجودی</Text></Pressable><Pressable style={styles.smallAction} onPress={() => setNotice(`ویرایش قیمت «${item.title}» در پیش‌نمایش شبیه‌سازی شد.`)}><Text style={styles.smallActionText}>ویرایش قیمت</Text></Pressable>{i === 1 && <Text style={styles.discountTag}>٪ تخفیف</Text>}</View></View>)}
          </>}
          {previewTab === "settlements" && <>
            <View style={styles.revenueCard}><Text style={styles.revenueLabel}>فروش خالص این ماه</Text><Text style={styles.revenueValue}>۱۲۴٬۸۶۰٬۰۰۰ <Text style={styles.revenueUnit}>ریال</Text></Text><Text style={styles.revenueChange}>در ۲۳ سفارش تکمیل‌شده</Text></View>
            <Text style={styles.sectionTitle}>خلاصهٔ مالی</Text>
            {[["در انتظار تسویه", "۱۸٬۴۰۰٬۰۰۰ ریال", "#C98035"], ["تسویه‌شده", "۱۰۶٬۴۶۰٬۰۰۰ ریال", "#407764"], ["سفارش‌های تکمیل‌شده", "۲۳ سفارش", "#1C3F3A"]].map(([label, value, color]) => <View key={label} style={styles.financeRow}><Text style={[styles.financeValue, { color }]}>{value}</Text><Text style={styles.productName}>{label}</Text></View>)}
            <View style={styles.infoBanner}><Text style={styles.infoText}>مبالغ این صفحه نمونه‌اند و برای نمایش رابط کاربری استفاده شده‌اند.</Text></View>
          </>}
          {previewTab === "notifications" && <>
            {[["سفارش جدید دریافت شد", "سفارش HN-۱۴۰۵-۲۴۸۱ ثبت شده و در انتظار تأیید شماست.", "۱۰:۲۵", "#FFF2E7"], ["موجودی کالا رو به اتمام است", "موجودی برنج هاشمی به ۸ عدد رسیده است.", "دیروز · ۱۷:۴۰", "#FCECE8"], ["تسویه با موفقیت انجام شد", "مبلغ ۱۲٬۶۰۰٬۰۰۰ ریال به حساب شما واریز شد.", "دیروز · ۱۲:۱۵", "#EAF5EF"]].map(([heading, body, time, color]) => <View key={heading} style={styles.notificationCard}><View style={[styles.notificationIcon, { backgroundColor: color }]}><Text style={styles.quickActionIcon}>•</Text></View><View style={styles.notificationContent}><Text style={styles.productName}>{heading}</Text><Text style={styles.infoText}>{body}</Text><Text style={styles.previewOrderDate}>{time}</Text></View></View>)}
          </>}
          {notice ? <Pressable onPress={() => setNotice("")} style={styles.noticeBox}><Text style={styles.noticeText}>{notice}  ×</Text></Pressable> : null}
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        {([["dashboard", "خانه"], ["orders", "سفارش‌ها"], ["products", "کالاها"], ["inventory", "موجودی"], ["settlements", "گزارش"]] as const).map(([key, label]) => <Pressable key={key} onPress={() => { setPreviewTab(key); setNotice(""); }} style={styles.navItem}><Text style={previewTab === key ? styles.navSelected : styles.navLabel}>{label}</Text></Pressable>)}
      </View>
    </>;
  }

  return <SafeAreaProvider>
    <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" translucent={false} />
    <SafeAreaView style={styles.root}>
      {!fontsLoaded && !fontError ? <Text style={styles.muted}>در حال آماده‌سازی…</Text> : <>
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <View style={styles.brand}>
            <Text style={styles.heading}>پیشخوان فروشنده حنا</Text>
            <Text style={styles.muted}>{seller?.storeName ?? "ورود امن فروشنده"}</Text>
          </View>
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
  root: { flex: 1, backgroundColor: "#FAF8F5" },
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
});
