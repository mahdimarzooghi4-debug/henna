import { useEffect } from "react";
import { Alert, BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const back = require("../assets/addresses-chevron.png");
const generalIcon = require("../assets/credits-general.png");
const socialIcon = require("../assets/credits-social.png");
const organizationIcon = require("../assets/credits-org.png");
const emptyIcon = require("../assets/credits-empty.png");
const divider = require("../assets/credits-divider.png");
const userNav = require("../assets/figma-nav-user.png");
const ordersNav = require("../assets/figma-nav-receipt.png");
const cartNav = require("../assets/figma-nav-cart.png");
const homeNav = require("../assets/figma-nav-home.png");

type Props = { onBack: () => void; onOrders: () => void; onCart: () => void; onHome: () => void };

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

function CreditCard({
  title, kind, description, icon, footer, status,
}: {
  title: string;
  kind: string;
  description: string;
  icon: number;
  footer?: string;
  status?: string;
}) {
  return (
    <View style={styles.creditCard}>
      <View style={styles.creditHeader}>
        <View style={[styles.kindBadge, kind === "طرح عمومی" ? styles.generalBadge : kind === "اختصاصی" ? styles.socialBadge : styles.orgBadge]}>
          <Text style={[styles.kindText, kind === "طرح عمومی" ? styles.generalText : kind === "اختصاصی" ? styles.socialText : styles.orgText]}>{kind}</Text>
        </View>
        <View style={styles.creditTitleGroup}>
          <Text style={styles.creditTitle}>{title}</Text>
          <Image source={icon} style={styles.creditIcon} accessibilityLabel="" />
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
      {footer ? (
        <>
          <Image source={divider} resizeMode="stretch" style={styles.divider} accessibilityLabel="" />
          <View style={styles.creditFooter}>
            <Text style={styles.footerAction}>{footer}</Text>
            <Text style={styles.footerMeta}>{status}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export function BuyerCreditsPlansScreen({ onBack, onOrders, onCart, onHome }: Props) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const unavailable = () => Alert.alert("اعتبارها و طرح‌ها", "مدیریت اعتبار و درخواست طرح در نسخهٔ پیش‌نمایش به سرویس حساب متصل نیست.");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به حساب کاربری" onPress={onBack} style={styles.backButton}>
          <Image source={back} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>اعتبارها و طرح‌ها</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>در این بخش، اعتبارات سازمانی، طرح‌های فعال و کالابرگ‌های اختصاصی شما قابل مشاهده و مدیریت است.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اعتبارهای فعال حساب شما</Text>
          <CreditCard
            title="کالابرگ عمومی حنا"
            kind="طرح عمومی"
            description="قابل استفاده برای خرید مستقیم اقلام پرمصرف و طرح‌های منتخب بازار اجتماعی."
            icon={generalIcon}
            footer="مشاهده لیست اقلام و فروشگاه‌ها ←"
            status="وضعیت: فعال"
          />
          <CreditCard
            title="اعتبار حمایتی اجتماعی"
            kind="اختصاصی"
            description="تسهیلات غیرنقدی تخصیص‌یافته جهت مشارکت‌های اجتماعی و خرید معیشتی."
            icon={socialIcon}
            footer="قوانین و محدودیت‌های طرح"
            status="مهلت استفاده: پایان سال جاری"
          />
          <CreditCard
            title="تسهیلات رفاهی کارکنان"
            kind="سازمانی"
            description="اعتبار اختصاص‌یافته از طرف نهادهای همکار برای خرید محصولات بازار اجتماعی حنا."
            icon={organizationIcon}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>سایر طرح‌ها</Text>
          <View style={styles.emptyCard}>
            <Image source={emptyIcon} style={styles.emptyIcon} accessibilityLabel="طرحی ثبت نشده" />
            <Text style={styles.emptyTitle}>در حال حاضر اعتبار فعالی برای این حساب ثبت نشده است.</Text>
            <Text style={styles.emptyDescription}>برای عضویت در طرح‌ها، کدهای اختصاصی یا معرفی‌نامه خود را از بخش پشتیبانی ثبت کنید.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="درخواست طرح یا ثبت معرفی‌نامه" onPress={unavailable} style={styles.requestButton}>
              <Text style={styles.requestText}>درخواست طرح یا ثبت معرفی‌نامه</Text>
            </Pressable>
          </View>
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
  notice: { width: "100%", minHeight: 58, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#0f5b5a", backgroundColor: "#e8f2f2", justifyContent: "center" },
  noticeText: { color: "#0f5b5a", fontSize: 12, lineHeight: 18, fontWeight: "600", ...rtl },
  section: { width: "100%", alignItems: "flex-end", gap: 12 },
  sectionTitle: { width: "100%", color: "#2d2d2d", fontSize: 15, lineHeight: 22, fontWeight: "700", ...rtl },
  creditCard: { width: "100%", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "flex-end", gap: 12 },
  creditHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kindBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  generalBadge: { backgroundColor: "#fdf1ee" },
  socialBadge: { backgroundColor: "#e8f2f2" },
  orgBadge: { backgroundColor: "#f0e7dd" },
  kindText: { fontSize: 11, lineHeight: 16, fontWeight: "700", ...rtl },
  generalText: { color: "#b5523b" },
  socialText: { color: "#0f5b5a" },
  orgText: { color: "#2d2d2d" },
  creditTitleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  creditTitle: { color: "#2d2d2d", fontSize: 14, lineHeight: 21, fontWeight: "700", ...rtl },
  creditIcon: { width: 18, height: 18 },
  description: { width: "100%", color: "#8e8e93", fontSize: 12, lineHeight: 20, ...rtl },
  divider: { width: "100%", height: 1 },
  creditFooter: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  footerAction: { color: "#0f5b5a", fontSize: 12, lineHeight: 18, fontWeight: "700", ...rtl },
  footerMeta: { color: "#8e8e93", fontSize: 12, lineHeight: 18, ...rtl },
  emptyCard: { width: "100%", minHeight: 242, padding: 24, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 14 },
  emptyIcon: { width: 40, height: 40 },
  emptyTitle: { color: "#8e8e93", fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: "center", writingDirection: "rtl" },
  emptyDescription: { color: "#8e8e93", fontSize: 11, lineHeight: 17, textAlign: "center", writingDirection: "rtl" },
  requestButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#0f5b5a" },
  requestText: { color: "#0f5b5a", fontSize: 12, lineHeight: 18, fontWeight: "700", ...rtl },
  nav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
