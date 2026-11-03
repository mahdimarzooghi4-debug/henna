import { Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";
import { buyerAccountIcons } from "./buyer-account-icons";

const logo = require("../assets/home-logo-badge.png");
const userNav = require("../assets/figma-nav-user.png");
const ordersNav = require("../assets/figma-nav-receipt.png");
const cartNav = require("../assets/figma-nav-cart.png");
const homeNav = require("../assets/figma-nav-home.png");
const notificationsIcon = require("../assets/home-icon-bell.png");

type Props = { onBack: () => void; onOrders: () => void; onCart: () => void; onHome: () => void; onLogout: () => void; onProfile: () => void; onAddresses: () => void; onCredits: () => void; onSocial: () => void; onSupport: () => void; onNotifications: () => void };
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const menu = [
  ["اطلاعات حساب", "user"], ["آدرس‌های من", "map-pin"], ["سفارش‌های من", "receipt"],
  ["روش‌های پرداخت", "credit-card"], ["اعتبارهای من", "star"], ["طرح‌های فعال", "heart"],
  ["مشارکت‌های اجتماعی", "phone"], ["پشتیبانی", "settings"], ["اعلان‌ها", "bell"], ["تنظیمات", "settings"],
] as const;

export function BuyerAccountScreen({ onBack, onOrders, onCart, onHome, onLogout, onProfile, onAddresses, onCredits, onSocial, onSupport, onNotifications }: Props) {
  const openMenu = (title: string) => {
    if (title === "سفارش‌های من") return onOrders();
    if (title === "اطلاعات حساب") return onProfile();
    if (title === "آدرس‌های من") return onAddresses();
    if (title === "اعتبارهای من" || title === "طرح‌های فعال") return onCredits();
    if (title === "مشارکت‌های اجتماعی") return onSocial();
    if (title === "پشتیبانی") return onSupport();
    if (title === "اعلان‌ها") return onNotifications();
    return Alert.alert(title, "این بخش در پیش‌نمایش هنوز به اطلاعات حساب متصل نیست.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت" onPress={onBack} style={styles.back}>
          <Image source={buyerAccountIcons["chevron-right"]} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>حساب کاربری</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>ک‌ن</Text></View>
          <Text style={styles.name}>کاربر نمونه</Text>
          <View style={styles.meta}>
            <Text style={styles.phone}>شماره تماس نمونه</Text>
            <View style={styles.typeBadge}><Text style={styles.typeText}>شخص حقیقی</Text></View>
          </View>
        </View>

        <View style={styles.credit}>
          <Text style={styles.creditTitle}>اعتبارهای من</Text>
          <View style={styles.creditRow}>
            <Text style={styles.creditSub}>اعتبار قابل استفاده</Text>
            <Text style={styles.creditAmount}>۰ تومان</Text>
          </View>
          <View style={styles.creditLine} />
          <Pressable accessibilityRole="button" onPress={() => openMenu("اعتبارهای من")} style={styles.creditLink}>
            <Text style={styles.creditLinkText}>در حال حاضر اعتباری ثبت نشده است</Text>
            <Text style={styles.creditLinkText}>←</Text>
          </Pressable>
        </View>

        <View style={styles.menuCard}>
          {menu.map(([title, icon], i) => (
            <View key={title}>
              <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => openMenu(title)} style={styles.menuRow}>
                <Image source={buyerAccountIcons["chevron-left"]} style={styles.chevron} />
                <View style={styles.menuRight}>
                  <Text style={styles.menuText}>{title}</Text>
                  <Image source={icon === "bell" ? notificationsIcon : buyerAccountIcons[icon]} style={styles.menuIcon} />
                </View>
              </Pressable>
              {i < menu.length - 1 ? <View style={styles.menuLine} /> : null}
            </View>
          ))}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="خروج از حساب کاربری" onPress={onLogout} style={styles.logout}>
          <Text style={styles.logoutText}>خروج از حساب کاربری</Text>
        </Pressable>

        <View style={styles.legal}>
          <Text style={styles.legalTitle}>خرید حقوقی</Text>
          <Text style={styles.legalDescription}>برای خرید به نام شرکت و دریافت فاکتور رسمی، اطلاعات شرکت را ثبت کنید.</Text>
          <View style={styles.companyCard}>
            <Text style={styles.companyTitle}>اطلاعات شرکت ثبت شده است</Text>
            <View style={styles.companyActions}>
              <Pressable accessibilityRole="button" onPress={() => openMenu("مشاهده اطلاعات")} style={styles.companyButton}>
                <Text style={styles.companyButtonText}>مشاهده اطلاعات</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => openMenu("ویرایش اطلاعات")} style={[styles.companyButton, styles.companyPrimary]}>
                <Text style={[styles.companyButtonText, styles.companyPrimaryText]}>ویرایش اطلاعات</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.nav}>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="حساب" accessibilityState={{ selected: true }}>
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
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  logo: { width: 80, height: 36 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 12 },
  profile: { minHeight: 132, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#e8f2f2" },
  avatarText: { color: "#0f5b5a", fontSize: 22, lineHeight: 30, fontWeight: "700", ...rtl },
  name: { color: "#2d2d2d", fontSize: 16, lineHeight: 22, fontWeight: "700", ...rtl },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  phone: { color: "#8e8e93", fontSize: 12, lineHeight: 17, ...rtl },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#f0e7dd" },
  typeText: { color: "#8e8e93", fontSize: 10, lineHeight: 14, fontWeight: "600", ...rtl },
  credit: { minHeight: 118, padding: 16, borderRadius: 16, backgroundColor: "#0f5b5a", alignItems: "flex-end", justifyContent: "space-between" },
  creditTitle: { color: "#fff", opacity: 0.8, fontSize: 12, lineHeight: 17, ...rtl },
  creditRow: { width: "100%", flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  creditSub: { color: "#fff", opacity: 0.8, fontSize: 12, lineHeight: 17, ...rtl },
  creditAmount: { color: "#fff", fontSize: 24, lineHeight: 34, fontWeight: "800", ...rtl },
  creditLine: { width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  creditLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  creditLinkText: { color: "#d7b895", fontSize: 11, lineHeight: 16, ...rtl },
  menuCard: { paddingHorizontal: 8, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  menuRow: { height: 41, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chevron: { width: 16, height: 16 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuText: { color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "600", ...rtl },
  menuIcon: { width: 18, height: 18 },
  menuLine: { height: 1, backgroundColor: "#f0e7dd" },
  logout: { height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  logoutText: { color: "#b5523b", fontSize: 12, lineHeight: 17, fontWeight: "600", ...rtl },
  legal: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", gap: 6 },
  legalTitle: { color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "700", ...rtl },
  legalDescription: { color: "#8e8e93", fontSize: 11, lineHeight: 15, ...rtl },
  companyCard: { marginTop: 4, padding: 10, borderRadius: 12, backgroundColor: "#e8f2f2", gap: 9 },
  companyTitle: { color: "#0f5b5a", fontSize: 12, lineHeight: 17, fontWeight: "700", ...rtl },
  companyActions: { flexDirection: "row", gap: 8 },
  companyButton: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#fff" },
  companyPrimary: { backgroundColor: "#0f5b5a" },
  companyButtonText: { color: "#0f5b5a", fontSize: 11, lineHeight: 16, fontWeight: "600", ...rtl },
  companyPrimaryText: { color: "#fff" },
  nav: { height: 84, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  navIcon: { width: 22, height: 22, opacity: 0.54 },
  navActive: { opacity: 1 },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
