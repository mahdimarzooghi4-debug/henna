import { useState } from "react";
import {
  Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const backIcon = require("../assets/home-icon-arrow-left.png");
const mapPinIcon = require("../assets/checkout-map-pin.png");
const truckIcon = require("../assets/checkout-truck.png");
const userIcon = require("../assets/figma-nav-user.png");
const ordersIcon = require("../assets/figma-nav-receipt.png");
const cartIcon = require("../assets/figma-nav-cart.png");
const homeIcon = require("../assets/figma-nav-home.png");
const successCheckIcon = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxklEQVRYhe2VQQrCMBBFsxbbSQuC4Dl6CTd1k0X+SD2Dl3XReyjqRhmFCo3VVUaEeQeY/9LmT5wzDEOBeQgLAvYlc+O0qbtuRYyeGLcS8UhA9ZNwEgHGSU2gHoUT4+KBViV8tgtLAg5DOOKVtnFj4f/x2UvmJor3VW/cARUj64+h/QyWC18EJCuvoZ9lMhSNQ+0MuibRNaeFzGuCThPSaj0vJiQUF0y/s3vUF+vPpXQ3+0+ldALT+6E5sMyRk6tfnLDMFxm7mc9za+xWwOVAAAAAElFTkSuQmCC" };
const successBackIcon = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAV0lEQVQ4jWNgGAU0A7yRkV58UZGf+CIjM6ljYFSUD3901D8Q5ouOzKKKofxRUakIQyNyR5ihfNGRWVQNUz5qGsiP7OWYyJxhahgvtRM2L7Wz3ihgIBYAAFeKQhxmPBywAAAAAElFTkSuQmCC" };

export type CheckoutItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  items: CheckoutItem[];
  sellerName: string;
  shippingLabel: string;
  onBack: () => void;
  onLogin: () => void;
  onCart: () => void;
  onHome: () => void;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

export function BuyerCheckoutScreen({
  items, sellerName, shippingLabel, onBack, onLogin, onCart, onHome,
}: Props) {
  const [showSuccessPreview, setShowSuccessPreview] = useState(false);
  const [paymentSources, setPaymentSources] = useState({ online: true, support: false, personal: true });
  const [legalInvoice, setLegalInvoice] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const togglePayment = (key: "online" | "support" | "personal") => {
    setPaymentSources((current) => ({ ...current, [key]: !current[key] }));
  };

  if (showSuccessPreview) return (
    <BuyerOrderSuccessPreview
      sellerName={sellerName}
      onBack={() => setShowSuccessPreview(false)}
      onLogin={onLogin}
      onCart={onCart}
      onHome={onHome}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8f5" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="بازگشت به بررسی سبد"
          onPress={onBack}
          style={styles.headerBack}
        >
          <Image source={backIcon} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>ثبت سفارش</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.addressCard]}>
          <View style={styles.sectionHeading}>
            <Text style={styles.cardHeading}>آدرس و مشخصات تحویل‌گیرنده</Text>
            <Image source={mapPinIcon} style={styles.sectionIcon} accessibilityLabel="نشانی" />
          </View>
          <Pressable accessibilityRole="button" onPress={() => Alert.alert("نشانی تحویل", "مدیریت نشانی‌ها در نسخهٔ بعدی فعال می‌شود.")}>
            <Text style={styles.addressText}>آدرس نمونه</Text>
          </Pressable>
          <View style={styles.addressDivider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>شماره تماس: نمونه</Text>
            <Text style={styles.metaText}>تحویل‌گیرنده: کاربر نمونه</Text>
          </View>
        </View>

        <View style={[styles.card, styles.shippingCard]}>
          <View style={styles.sectionHeading}>
            <Text style={styles.cardHeading}>شیوه و زمان ارسال</Text>
            <Image source={truckIcon} style={styles.sectionIcon} accessibilityLabel="ارسال" />
          </View>
          <View style={styles.shippingPill}>
            <Text style={styles.shippingSeller}>فروشنده انتخاب‌شده: {sellerName}</Text>
          </View>
          <Text style={styles.helperText}>
            سفارش پس از تایید نهایی، از فروشگاه انتخاب‌شده ارسال می‌شود.
          </Text>
        </View>

        <View style={[styles.card, styles.paymentCard]}>
          <Text style={styles.cardHeading}>روش پرداخت</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: paymentSources.online }}
            onPress={() => togglePayment("online")}
            style={[styles.paymentOption, styles.optionOnline, paymentSources.online && styles.optionSelected]}
          >
            <Radio selected={paymentSources.online} />
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitleTeal}>درگاه آنلاین بانکی</Text>
              <Text style={styles.optionDescription}>پرداخت امن با کلیه کارت‌های عضو شتاب</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: paymentSources.support }}
            onPress={() => togglePayment("support")}
            style={[styles.paymentOption, styles.optionSupport, paymentSources.support && styles.optionSelected]}
          >
            <Radio selected={paymentSources.support} />
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>اعتبار حمایتی موجود</Text>
              <Text style={styles.optionDescription}>
                اعتبار حمایتی یک منبع پرداخت جداگانه است و بر اساس قوانین موجود، ممکن است برای این سفارش در دسترس باشد.
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: paymentSources.personal }}
            onPress={() => togglePayment("personal")}
            style={[styles.paymentOption, styles.optionPersonal, paymentSources.personal && styles.optionSelected]}
          >
            <Radio selected={paymentSources.personal} />
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitleTeal}>اعتبار شخصی تأمین‌شده توسط کاربر</Text>
              <Text style={styles.optionDescription}>
                این منبع پرداخت برای خریدهای شخصی و بر اساس شرایط موجود برای کاربر فعال است.
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: legalInvoice }}
            onPress={() => setLegalInvoice((value) => !value)}
            style={[styles.paymentOption, styles.optionLegal]}
          >
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>خرید حقوقی و دریافت فاکتور رسمی</Text>
              <Text style={styles.optionDescription}>
                با فعال‌کردن این گزینه، فاکتور سفارش به نام شرکت ثبت‌شده صادر می‌شود.
              </Text>
            </View>
            <View style={[styles.switchTrack, legalInvoice && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, legalInvoice && styles.switchThumbOn]} />
            </View>
          </Pressable>
        </View>

        <View style={[styles.card, styles.summaryCard]}>
          <Text style={styles.cardHeading}>خلاصه صورت‌حساب</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{fa(subtotal)} تومان</Text>
            <Text style={styles.summaryLabel}>مجموع اقلام سبد:</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.shippingValue}>{shippingLabel}</Text>
            <Text style={styles.summaryLabel}>هزینه ارسال:</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalValue}>{fa(subtotal)} تومان</Text>
            <Text style={styles.totalLabel}>جمع فعلی کالاها:</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert(
            "پیش‌نمایش سفارش موفق",
            "سفارش واقعی ثبت یا پرداخت نمی‌شود. برای بازبینی رابط، صفحهٔ موفقیت با داده‌های نمونه باز می‌شود.",
            [
              { text: "بستن", style: "cancel" },
              { text: "نمایش پیش‌نمایش", onPress: () => setShowSuccessPreview(true) },
            ],
          )}
          style={styles.confirmButton}
        >
          <Text style={styles.confirmText}>ثبت نهایی و پرداخت سفارش</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={onLogin}>
          <Image source={userIcon} style={styles.navIcon} accessibilityLabel="حساب" />
          <Text style={styles.navLabel}>حساب</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={onLogin}>
          <Image source={ordersIcon} style={styles.navIcon} accessibilityLabel="سفارش‌ها" />
          <Text style={styles.navLabel}>سفارش‌ها</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityState={{ selected: true }} onPress={onCart}>
          <Image source={cartIcon} style={[styles.navIcon, styles.navIconActive]} accessibilityLabel="سبد" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>سبد</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={onHome}>
          <Image source={homeIcon} style={styles.navIcon} accessibilityLabel="خانه" />
          <Text style={styles.navLabel}>خانه</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function BuyerOrderSuccessPreview({
  sellerName, onBack, onLogin, onCart, onHome,
}: {
  sellerName: string; onBack: () => void; onLogin: () => void; onCart: () => void; onHome: () => void;
}) {
  return (
    <SafeAreaView style={successStyles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={successStyles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به ثبت سفارش" onPress={onBack} style={successStyles.headerBack}>
          <Image source={successBackIcon} style={successStyles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={successStyles.headerTitle}>ثبت سفارش</Text>
        <Image source={logo} resizeMode="contain" style={successStyles.logo} accessibilityLabel="حنا" />
      </View>
      <ScrollView style={successStyles.fill} contentContainerStyle={successStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={successStyles.successHero}>
          <View style={successStyles.successIconWrap}>
            <Image source={successCheckIcon} style={successStyles.successIcon} accessibilityLabel="ثبت موفق" />
          </View>
          <View style={successStyles.heroCopy}>
            <Text style={successStyles.successTitle}>سفارش نمونه با موفقیت ثبت شد.</Text>
            <Text style={successStyles.orderCode}>کد سفارش: نمونه</Text>
          </View>
        </View>
        <View style={successStyles.summaryCard}>
          <Text style={successStyles.summaryHeading}>خلاصه سفارش</Text>
          <View style={successStyles.summaryRow}><Text style={successStyles.summaryValue}>{sellerName}</Text><Text style={successStyles.summaryLabel}>فروشگاه تأمین‌کننده:</Text></View>
          <View style={successStyles.summaryRow}><Text style={successStyles.summaryValue}>کاربر نمونه</Text><Text style={successStyles.summaryLabel}>تحویل‌گیرنده:</Text></View>
          <View style={successStyles.summaryRow}><Text style={successStyles.summaryValue}>مبلغ نمونه</Text><Text style={successStyles.summaryLabel}>مبلغ کل پرداختی:</Text></View>
          <View style={successStyles.summaryRow}><Text style={successStyles.paymentSample}>پرداخت نمونه</Text><Text style={successStyles.summaryLabel}>وضعیت پرداخت:</Text></View>
        </View>
        <View style={successStyles.noticeCard}>
          <Text style={successStyles.noticeTitle}>سفارش نمونه ثبت شد</Text>
          <Text style={successStyles.noticeCopy}>خلاصه سفارش و مراحل بعدی در این صفحه نمایش داده می‌شود.</Text>
        </View>
        <View style={successStyles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="پیگیری سفارش" onPress={() => Alert.alert("پیگیری سفارش", "پیگیری سفارش تا اتصال سرویس سفارش در دسترس نیست.")} style={successStyles.trackButton}>
            <Text style={successStyles.trackButtonText}>پیگیری سفارش</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به بازارگاه" onPress={onHome} style={successStyles.marketplaceButton}>
            <Text style={successStyles.marketplaceButtonText}>بازگشت به بازارگاه</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={onLogin}><Image source={userIcon} style={styles.navIcon} accessibilityLabel="حساب" /><Text style={styles.navLabel}>حساب</Text></Pressable>
        <Pressable style={styles.navItem} onPress={onLogin}><Image source={ordersIcon} style={styles.navIcon} accessibilityLabel="سفارش‌ها" /><Text style={styles.navLabel}>سفارش‌ها</Text></Pressable>
        <Pressable style={styles.navItem} accessibilityState={{ selected: true }} onPress={onCart}><Image source={cartIcon} style={[styles.navIcon, styles.navIconActive]} accessibilityLabel="سبد" /><Text style={[styles.navLabel, styles.navLabelActive]}>سبد</Text></Pressable>
        <Pressable style={styles.navItem} onPress={onHome}><Image source={homeIcon} style={styles.navIcon} accessibilityLabel="خانه" /><Text style={styles.navLabel}>خانه</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const successStyles = StyleSheet.create({
  fill: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f3ed" },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  logo: { width: 80, height: 36 }, scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100, gap: 16 },
  successHero: { width: "100%", paddingTop: 32, paddingBottom: 24, gap: 20, alignItems: "center" },
  successIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#e8f2f2" },
  successIcon: { width: 32, height: 32 }, heroCopy: { width: "100%", gap: 8, alignItems: "center" },
  successTitle: { color: "#0f5b5a", fontSize: 22, fontWeight: "800", ...rtl, textAlign: "center" },
  orderCode: { color: "#8e8e93", fontSize: 14, ...rtl, textAlign: "center" },
  summaryCard: { width: "100%", padding: 16, gap: 12, alignItems: "flex-end", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff" },
  summaryHeading: { color: "#8e8e93", fontSize: 14, fontWeight: "700", ...rtl },
  summaryRow: { width: "100%", minHeight: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  summaryLabel: { color: "#8e8e93", fontSize: 14, ...rtl }, summaryValue: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  paymentSample: { color: "#0f5b5a", fontSize: 14, fontWeight: "700", ...rtl },
  noticeCard: { width: "100%", padding: 14, gap: 8, alignItems: "flex-end", borderWidth: 1, borderColor: "#0f5b5a", borderRadius: 12, backgroundColor: "#e8f2f2" },
  noticeTitle: { width: "100%", color: "#0f5b5a", fontSize: 14, fontWeight: "700", ...rtl }, noticeCopy: { width: "100%", color: "#2d2d2d", fontSize: 13, lineHeight: 20, ...rtl },
  actions: { width: "100%", gap: 12 },
  trackButton: { width: "100%", paddingHorizontal: 24, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#0f5b5a" },
  trackButtonText: { color: "#fff", fontSize: 15, fontWeight: "800", ...rtl },
  marketplaceButton: { width: "100%", paddingHorizontal: 24, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#0f5b5a", borderRadius: 12 },
  marketplaceButtonText: { color: "#0f5b5a", fontSize: 15, fontWeight: "700", ...rtl },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#faf8f5" },
  header: {
    height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", backgroundColor: "#faf8f5",
  },
  headerBack: {
    width: 40, height: 40, alignItems: "center", justifyContent: "center",
    borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff",
  },
  backIcon: { width: 20, height: 20 },
  headerTitle: {
    position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18,
    lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center",
  },
  logo: { width: 80, height: 36 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 16 },
  card: {
    width: "100%", padding: 14, borderWidth: 1, borderColor: "#f0e7dd",
    borderRadius: 16, backgroundColor: "#fff",
  },
  addressCard: { height: 134, paddingTop: 13, paddingBottom: 12 },
  shippingCard: { height: 142, paddingTop: 13, paddingBottom: 12 },
  sectionHeading: { height: 26, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  cardHeading: { color: "#2d2d2d", fontSize: 15, fontWeight: "700", ...rtl },
  sectionIcon: { width: 16, height: 16 },
  addressText: { height: 23, marginTop: 12, color: "#2d2d2d", fontSize: 13, lineHeight: 23, ...rtl },
  addressDivider: { height: 1, marginTop: 12, backgroundColor: "#f0e7dd" },
  divider: { height: 1, backgroundColor: "#f0e7dd" },
  metaRow: { height: 21, marginTop: 11, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metaText: { color: "#8e8e93", fontSize: 12, ...rtl },
  shippingPill: {
    height: 43, marginTop: 12, paddingHorizontal: 12, justifyContent: "center",
    borderRadius: 10, backgroundColor: "#e8f2f2",
  },
  shippingSeller: { color: "#0f5b5a", fontSize: 13, fontWeight: "600", ...rtl },
  helperText: { height: 21, marginTop: 12, color: "#8e8e93", fontSize: 12, lineHeight: 21, ...rtl },
  paymentCard: { gap: 12 },
  paymentOption: {
    width: "100%", paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row",
    alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#f0e7dd",
    borderRadius: 12, backgroundColor: "#faf8f5",
  },
  optionOnline: { height: 68 },
  optionSupport: { height: 106 },
  optionPersonal: { height: 87 },
  optionLegal: { height: 89 },
  optionSelected: { borderColor: "#0f5b5a", backgroundColor: "#e8f2f2" },
  radio: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 1.5,
    borderColor: "#8e8e93", alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderWidth: 3, borderColor: "#0f5b5a" },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0f5b5a" },
  optionCopy: { flex: 1, gap: 4, alignItems: "flex-end" },
  optionTitle: { color: "#2d2d2d", fontSize: 13, fontWeight: "600", ...rtl },
  optionTitleTeal: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  optionDescription: { width: "100%", color: "#8e8e93", fontSize: 11, lineHeight: 17, ...rtl },
  switchTrack: {
    width: 36, height: 20, padding: 2, borderRadius: 10,
    backgroundColor: "#e8f2f2", alignItems: "flex-start", justifyContent: "center",
  },
  switchTrackOn: { backgroundColor: "#0f5b5a", alignItems: "flex-end" },
  switchThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  switchThumbOn: { backgroundColor: "#fff" },
  summaryCard: { height: 184, gap: 12 },
  summaryRow: { width: "100%", height: 25, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { color: "#8e8e93", fontSize: 14, ...rtl },
  summaryValue: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  shippingValue: { color: "#0f5b5a", fontSize: 14, fontWeight: "700", ...rtl },
  totalLabel: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  totalValue: { color: "#b5523b", fontSize: 16, fontWeight: "800", ...rtl },
  confirmButton: {
    height: 54, alignItems: "center", justifyContent: "center",
    borderRadius: 12, backgroundColor: "#b5523b",
  },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "800", ...rtl },
  bottomNav: {
    height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20,
    flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-around",
    borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navIconActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
