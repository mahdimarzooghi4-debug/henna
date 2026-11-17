import { useEffect, useState } from "react";
import { BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const chevron = require("../assets/addresses-chevron.png");
const userNav = require("../assets/figma-nav-user.png");
const ordersNav = require("../assets/figma-nav-receipt.png");
const cartNav = require("../assets/figma-nav-cart.png");
const homeNav = require("../assets/figma-nav-home.png");

type Props = { onBack: () => void; onOrders: () => void; onCart: () => void; onHome: () => void; onAccount?: () => void };
type Notification = { category: string; time: string; title: string; description: string; unread: boolean };
const initialNotifications: Notification[] = [
  { category: "سفارش", time: "۱۰ دقیقه پیش", title: "سفارش شما تحویل سفیر شد", description: "اقلام سفارش شماره ۲۴۹۱ برای ارسال بسته‌بندی گردید.", unread: true },
  { category: "طرح‌ها", time: "۳ ساعت پیش", title: "فعال‌سازی کالابرگ حمایتی جدید", description: "طرح خرید معیشتی فصلی برای حساب کاربری شما فعال شد.", unread: true },
  { category: "حساب", time: "دیروز", title: "تغییر رمز عبور موفقیت‌آمیز بود", description: "امنیت حساب شما اولویت ماست. تغییر با موفقیت انجام شد.", unread: false },
  { category: "اعتبارها", time: "۲ روز پیش", title: "ثبت اعتبار اولیه سازمانی", description: "تسهیلات رفاهی کارکنان از نهاد همکار به کیف پول شما افزوده شد.", unread: false },
  { category: "اطلاع‌رسانی عمومی", time: "۵ روز پیش", title: "بروزرسانی جدید بازار اجتماعی حنا", description: "طرح گرافیکی جدید و دسترسی سریع‌تر به آدرس‌ها اضافه شد.", unread: false },
];
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

export function BuyerNotificationsScreen({ onBack, onOrders, onCart, onHome, onAccount }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const markAllRead = () => setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  const markRead = (index: number) => setNotifications((items) => items.map((item, i) => i === index ? { ...item, unread: false } : item));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت" onPress={onBack} style={styles.backButton}>
          <Image source={chevron} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>اعلان‌ها</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="خوانده شده کردن همه" onPress={markAllRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>خوانده شده کردن همه</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>اعلان‌های اخیر</Text>
        </View>

        {notifications.map((notification, index) => (
          <Pressable
            key={`${notification.category}-${notification.title}`}
            accessibilityRole="button"
            accessibilityLabel={`${notification.category}: ${notification.title}، ${notification.time}${notification.unread ? "، خوانده نشده" : "، خوانده شده"}`}
            accessibilityState={{ selected: notification.unread }}
            onPress={() => markRead(index)}
            style={[styles.card, notification.unread ? styles.unreadCard : styles.readCard]}
          >
            <View style={styles.metaRow}>
              <View style={styles.timeGroup}>
                {notification.unread ? <View style={styles.unreadDot} /> : null}
                <Text style={styles.time}>{notification.time}</Text>
              </View>
              <View style={styles.categoryGroup}>
                <Text style={styles.category}>{notification.category}</Text>
                <View style={styles.categoryDot} />
              </View>
            </View>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.description}>{notification.description}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.nav}>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="حساب" onPress={onAccount ?? onBack}>
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
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 16 },
  sectionHeader: { width: "100%", minHeight: 26, paddingBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "700", ...rtl },
  markAllButton: { minHeight: 24, justifyContent: "center" },
  markAllText: { color: "#0f5b5a", fontSize: 13, lineHeight: 19, fontWeight: "700", ...rtl },
  card: { width: "100%", padding: 16, borderRadius: 16, backgroundColor: "#fff", alignItems: "flex-end", gap: 8 },
  unreadCard: { borderWidth: 1.5, borderColor: "#0f5b5a", shadowColor: "#0f5b5a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  readCard: { borderWidth: 1, borderColor: "#f0e7dd" },
  metaRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0f5b5a" },
  time: { color: "#8e8e93", fontSize: 11, lineHeight: 16, ...rtl },
  categoryGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  category: { color: "#0f5b5a", fontSize: 11, lineHeight: 16, fontWeight: "600", ...rtl },
  categoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0f5b5a" },
  notificationTitle: { width: "100%", color: "#2d2d2d", fontSize: 14, lineHeight: 21, fontWeight: "700", ...rtl },
  description: { width: "100%", color: "#8e8e93", fontSize: 12, lineHeight: 18, ...rtl },
  nav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
