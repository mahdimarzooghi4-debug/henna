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
        </> : gate.kind === "preview" ? <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.body}>
              <Text style={styles.heading}>پیش‌نمایش اپ فروشنده</Text>
              <View style={styles.panel}>
                <Text style={styles.kicker}>ورود آزمایشی · بدون پیامک</Text>
                <Text style={styles.cardTitle}>محیط نمایشی حنا</Text>
                <Text style={styles.muted}>هیچ فروشنده‌ای احراز هویت نشده است. سفارش، قیمت، تسویه و اطلاعات واقعی در این حالت قابل مشاهده یا تغییر نیست.</Text>
              </View>
              <View style={styles.metrics}>
                {["سفارش‌ها", "کالاها", "تسویه‌ها", "اعلان‌ها"].map(label =>
                  <View key={label} style={styles.metric}>
                    <Text style={styles.kicker}>{label}</Text>
                    <Text style={styles.metricUnavailable}>—</Text>
                  </View>)}
              </View>
              <Text style={styles.hint}>برای عملیات واقعی، تأیید فروشندگی و ورود امن از طریق سرور الزامی است.</Text>
              <Pressable style={styles.action} onPress={() => void signOut()}>
                <Text style={styles.actionText}>خروج از پیش‌نمایش</Text>
              </Pressable>
            </View>
          </ScrollView>
        </> : <KeyboardAvoidingView
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
                  </>}
                  )}
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
});
