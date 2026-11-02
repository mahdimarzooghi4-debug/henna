import { useState } from "react";
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const backIcon = require("../assets/home-icon-arrow-left.png");
const userIcon = require("../assets/figma-nav-user.png");
const ordersIcon = require("../assets/figma-nav-receipt.png");
const cartIcon = require("../assets/figma-nav-cart.png");
const homeIcon = require("../assets/figma-nav-home.png");

type Status = "جاری" | "تحویل‌شده" | "لغوشده";
type Props = {
  onBack: () => void;
  onTracking: () => void;
  onLogin: () => void;
  onCart: () => void;
  onHome: () => void;
};

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const orders = [
  { status: "جاری" as const, label: "در حال ارسال با پیک", type: "خرید شخصی", legal: true, products: "برنج طارم ایرانی درجه یک، پنیر سفید صبحانه حنا", date: "۱۴ اسفند ۱۴۰۲", price: "۲۶۵,۰۰۰ تومان" },
  { status: "تحویل‌شده" as const, label: "تحویل نهایی شده", type: "خرید حقوقی", legal: false, products: "ماست کم‌چرب پاستوریزه، تخم‌مرغ محلی ممتاز", date: "۲ اسفند ۱۴۰۲", price: "۱۴۲,۰۰۰ تومان" },
];

export function BuyerOrdersScreen({ onBack, onTracking, onLogin, onCart, onHome }: Props) {
  const [status, setStatus] = useState<Status>("جاری");
  const visibleOrders = status === "جاری"
    ? orders
    : orders.filter((order) => order.status === status);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به پیگیری سفارش" onPress={onBack} style={styles.headerBack}>
          <Image source={backIcon} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>سفارش‌های من</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.filters}>
          {(["لغوشده", "تحویل‌شده", "جاری"] as Status[]).map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityLabel={item} accessibilityState={{ selected: status === item }} onPress={() => setStatus(item)} style={[styles.filter, status === item && styles.filterSelected]}>
              <Text style={[styles.filterText, status === item && styles.filterTextSelected]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {visibleOrders.length ? visibleOrders.map((order) => (
          <View key={order.status} style={[styles.orderCard, order.legal ? styles.currentCard : styles.deliveredCard]}>
            <View style={styles.cardHeading}>
              <View style={[styles.statusBadge, order.legal && styles.statusBadgeCurrent, !order.legal && styles.statusBadgeDelivered]}>
                <Text style={[styles.statusText, order.legal && styles.currentStatusText, !order.legal && styles.deliveredStatusText]}>{order.label}</Text>
              </View>
              <Text style={styles.orderType}>{order.type}</Text>
            </View>
            <View style={styles.divider} />
            {order.legal ? <View style={styles.legalBadge}><Text style={styles.legalText}>خرید حقوقی</Text></View> : null}
            <View style={styles.detailRows}>
              <DetailRow label="فروشگاه:" value="فروشگاه نمونه" />
              <DetailRow label="محصولات:" value={order.products} />
              <DetailRow label="تاریخ ثبت:" value={order.date} />
            </View>
            <View style={styles.divider} />
            <View style={styles.cardFooter}>
              <Pressable accessibilityRole="button" accessibilityLabel="مشاهده جزئیات سفارش" onPress={onTracking} style={styles.detailsButton}>
                <Text style={styles.detailsText}>مشاهده جزئیات</Text>
              </Pressable>
              <Text style={styles.price}>{order.price}</Text>
            </View>
          </View>
        )) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{status === "لغوشده" ? "سفارش لغوشده‌ای ندارید" : "سفارشی در این وضعیت ندارید"}</Text>
            <Text style={styles.emptyDescription}>سفارش‌های شما در این بخش نمایش داده می‌شوند.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={onLogin}><Image source={userIcon} style={styles.navIcon} accessibilityLabel="حساب" /><Text style={styles.navLabel}>حساب</Text></Pressable>
        <Pressable style={styles.navItem} accessibilityState={{ selected: true }}><Image source={ordersIcon} style={[styles.navIcon, styles.navIconActive]} accessibilityLabel="سفارش‌ها" /><Text style={[styles.navLabel, styles.navLabelActive]}>سفارش‌ها</Text></Pressable>
        <Pressable style={styles.navItem} onPress={onCart}><Image source={cartIcon} style={styles.navIcon} accessibilityLabel="سبد" /><Text style={styles.navLabel}>سبد</Text></Pressable>
        <Pressable style={styles.navItem} onPress={onHome}><Image source={homeIcon} style={styles.navIcon} accessibilityLabel="خانه" /><Text style={styles.navLabel}>خانه</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text numberOfLines={1} style={styles.detailValue}>{value}</Text><Text style={styles.detailLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  logo: { width: 80, height: 36 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100, gap: 12 },
  filters: { height: 37, flexDirection: "row", gap: 8, marginBottom: 4 },
  filter: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  filterSelected: { backgroundColor: "#0f5b5a", borderColor: "#0f5b5a" },
  filterText: { color: "#2d2d2d", fontSize: 12, lineHeight: 17, ...rtl },
  filterTextSelected: { color: "#fff", fontWeight: "600" },
  orderCard: { width: "100%", paddingHorizontal: 15, paddingTop: 14, paddingBottom: 15, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff", alignItems: "flex-end", gap: 10 },
  currentCard: { minHeight: 257 },
  deliveredCard: { minHeight: 217 },
  cardHeading: { height: 29, width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeCurrent: { backgroundColor: "#fdf1ee" },
  statusBadgeDelivered: { backgroundColor: "#e8f2f2" },
  statusText: { fontSize: 11, lineHeight: 16, fontWeight: "600", ...rtl },
  currentStatusText: { color: "#b5523b" },
  deliveredStatusText: { color: "#0f5b5a" },
  orderType: { color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "700", ...rtl },
  divider: { width: "100%", height: 1, backgroundColor: "#f0e7dd" },
  legalBadge: { alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#fdf1ee" },
  legalText: { color: "#b5523b", fontSize: 11, lineHeight: 16, fontWeight: "600", ...rtl },
  detailRows: { width: "100%", gap: 7 },
  detailRow: { width: "100%", height: 18, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  detailValue: { flexShrink: 1, color: "#8e8e93", fontSize: 12, lineHeight: 17, ...rtl },
  detailLabel: { color: "#8e8e93", fontSize: 12, lineHeight: 17, ...rtl },
  cardFooter: { width: "100%", height: 34, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailsButton: { paddingHorizontal: 12, height: 34, justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#faf8f5" },
  detailsText: { color: "#0f5b5a", fontSize: 12, lineHeight: 17, fontWeight: "600", ...rtl },
  price: { color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "700", ...rtl },
  emptyCard: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: 8, padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16 },
  emptyTitle: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  emptyDescription: { color: "#8e8e93", fontSize: 12, ...rtl },
  bottomNav: { height: 84, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  navIcon: { width: 22, height: 22, opacity: 0.54 },
  navIconActive: { opacity: 1 },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
