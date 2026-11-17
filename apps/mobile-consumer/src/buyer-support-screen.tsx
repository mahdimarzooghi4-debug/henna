import { useEffect, useState } from "react";
import { Alert, BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const chevron = require("../assets/addresses-chevron.png");
const divider = require("../assets/addresses-divider.png");
const userNav = require("../assets/figma-nav-user.png");
const ordersNav = require("../assets/figma-nav-receipt.png");
const cartNav = require("../assets/figma-nav-cart.png");
const homeNav = require("../assets/figma-nav-home.png");

type Props = { onBack: () => void; onOrders: () => void; onCart: () => void; onHome: () => void };
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

const requests = [
  { id: "T-8921", status: "پاسخ داده شده", subject: "عدم ثبت نهایی تراکنش بانکی", updated: "۲۴ دی ۱۴۰۴", kind: "answered" as const },
  { id: "T-8740", status: "در حال بررسی", subject: "درخواست تغییر آدرس پیش‌فرض", updated: "۱۹ دی ۱۴۰۴", kind: "review" as const },
  { id: "T-8612", status: "ثبت شده", subject: "پیشنهاد افزودن غرفه محلی جدید", updated: "۱۵ دی ۱۴۰۴", kind: "submitted" as const },
];

const questions = [
  {
    title: "نحوه استفاده از طرح کالابرگ اجتماعی",
    answer: "کالاها و شرایط استفاده به طرح فعال شما بستگی دارد. اطلاعات طرح‌های فعال را از بخش اعتبارهای من ببینید.",
  },
  {
    title: "شرایط مرجوعی کالا در بازار محلی",
    answer: "شرایط بازگشت کالا با توجه به نوع کالا و فروشنده متفاوت است. برای پیگیری مورد مشخص، درخواست پشتیبانی ثبت کنید.",
  },
];

export function BuyerSupportScreen({ onBack, onOrders, onCart, onHome }: Props) {
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به حساب کاربری" onPress={onBack} style={styles.backButton}>
          <Image source={chevron} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>پشتیبانی حنا</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>چگونه می‌توانیم کمکتان کنیم؟</Text>
          <Text style={styles.noticeDescription}>تیم پشتیبانی حنا همواره در کنار شماست تا بهترین تجربه خرید و فروش اجتماعی را داشته باشید.</Text>
        </View>

        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>سوالات متداول</Text>
          <View style={styles.faqCard}>
            {questions.map((question, index) => (
              <View key={question.title}>
                {index > 0 ? <Image source={divider} resizeMode="stretch" style={styles.faqDivider} accessibilityLabel="" /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={question.title}
                  accessibilityState={{ expanded: expandedQuestion === index }}
                  onPress={() => setExpandedQuestion((current) => current === index ? null : index)}
                  style={styles.faqRow}
                >
                  <Image source={chevron} style={[styles.faqChevron, expandedQuestion === index && styles.faqChevronOpen]} accessibilityLabel="" />
                  <Text style={styles.faqTitle}>{question.title}</Text>
                </Pressable>
                {expandedQuestion === index ? <Text style={styles.faqAnswer}>{question.answer}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>پیگیری درخواست‌ها</Text>
          {requests.map((request) => (
            <Pressable
              key={request.id}
              accessibilityRole="button"
              accessibilityLabel={`کد درخواست: ${request.id}، ${request.subject}، ${request.status}`}
              onPress={() => Alert.alert(`درخواست ${request.id}`, `${request.subject}\nوضعیت: ${request.status}\nآخرین به‌روزرسانی: ${request.updated}`)}
              style={styles.requestCard}
            >
              <View style={styles.requestHeader}>
                <View style={[styles.statusBadge, request.kind === "answered" ? styles.answeredBadge : request.kind === "review" ? styles.reviewBadge : styles.submittedBadge]}>
                  <Text style={[styles.statusText, request.kind === "answered" ? styles.answeredText : request.kind === "review" ? styles.reviewText : styles.submittedText]}>{request.status}</Text>
                </View>
                <Text style={styles.requestCode}>کد درخواست: {request.id}</Text>
              </View>
              <Text style={styles.requestSubject}>موضوع: {request.subject}</Text>
              <Image source={divider} resizeMode="stretch" style={styles.requestDivider} accessibilityLabel="" />
              <Text style={styles.updatedText}>آخرین به روزرسانی: {request.updated}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ثبت درخواست جدید"
            onPress={() => Alert.alert("ثبت درخواست جدید", "ثبت درخواست در این پیش‌نمایش به سرویس پشتیبانی متصل نیست.")}
            style={styles.newRequestButton}
          >
            <Text style={styles.newRequestText}>ثبت درخواست جدید</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تماس با پشتیبانی تلفنی"
            onPress={() => Alert.alert("تماس با پشتیبانی تلفنی", "شماره تماس پشتیبانی در این پیش‌نمایش تنظیم نشده است.")}
            style={styles.phoneButton}
          >
            <Text style={styles.phoneText}>تماس با پشتیبانی تلفنی</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.nav}>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="حساب" accessibilityState={{ selected: true }} onPress={onBack}>
          <Image source={userNav} style={[styles.navIcon, styles.navActive]} /><Text style={[styles.navLabel, styles.navLabelActive]}>حساب</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="سفارش‌ها" onPress={onOrders}>
          <Image source={ordersNav} style={styles.navIcon} /><Text style={styles.navLabel}>سفارش‌ها</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="سبد" onPress={onCart}>
          <Image source={cartNav} style={styles.navIcon} /><Text style={styles.navLabel}>سبد</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="خانه" onPress={onHome}>
          <Image source={homeNav} style={styles.navIcon} /><Text style={styles.navLabel}>خانه</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f3ed" },
  fill: { flex: 1 },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 110, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  logo: { width: 80, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 20 },
  notice: { width: "100%", padding: 16, borderRadius: 16, backgroundColor: "#0f5b5a", alignItems: "flex-end", gap: 8 },
  noticeTitle: { width: "100%", color: "#fff", fontSize: 15, lineHeight: 22, fontWeight: "700", ...rtl },
  noticeDescription: { width: "100%", color: "#fff", opacity: 0.8, fontSize: 12, lineHeight: 18, ...rtl },
  faqSection: { width: "100%", alignItems: "flex-end", gap: 10 },
  sectionTitle: { color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "700", ...rtl },
  faqCard: { width: "100%", padding: 8, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  faqRow: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  faqChevron: { width: 16, height: 16, opacity: 0.22, transform: [{ rotate: "180deg" }] },
  faqChevronOpen: { transform: [{ rotate: "270deg" }] },
  faqTitle: { flex: 1, color: "#2d2d2d", fontSize: 13, lineHeight: 19, fontWeight: "600", ...rtl },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 12, color: "#8e8e93", fontSize: 11, lineHeight: 17, ...rtl },
  faqDivider: { width: "100%", height: 1 },
  requestsSection: { width: "100%", alignItems: "flex-end", gap: 12 },
  requestCard: { width: "100%", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", gap: 12 },
  requestHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  answeredBadge: { backgroundColor: "#e8f2f2" },
  reviewBadge: { backgroundColor: "#faf3e6" },
  submittedBadge: { backgroundColor: "#f0e7dd" },
  statusText: { fontSize: 11, lineHeight: 16, fontWeight: "700", ...rtl },
  answeredText: { color: "#0f5b5a" },
  reviewText: { color: "#d7b895" },
  submittedText: { color: "#8e8e93" },
  requestCode: { color: "#2d2d2d", fontSize: 13, lineHeight: 19, fontWeight: "700", ...rtl },
  requestSubject: { color: "#2d2d2d", fontSize: 13, lineHeight: 19, ...rtl },
  requestDivider: { width: "100%", height: 1 },
  updatedText: { width: "100%", color: "#8e8e93", fontSize: 11, lineHeight: 16, ...rtl },
  actions: { width: "100%", paddingTop: 8, gap: 10 },
  newRequestButton: { width: "100%", minHeight: 50, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: "#0f5b5a", alignItems: "center", justifyContent: "center" },
  newRequestText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "800", ...rtl, textAlign: "center" },
  phoneButton: { width: "100%", minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#b5523b", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  phoneText: { color: "#b5523b", fontSize: 13, lineHeight: 19, fontWeight: "700", ...rtl, textAlign: "center" },
  nav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
