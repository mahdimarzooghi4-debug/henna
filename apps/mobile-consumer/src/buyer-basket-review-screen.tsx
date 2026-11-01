import {
  Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const logo = require("../assets/home-logo-badge.png");
const backIcon = require("../assets/home-icon-arrow-left.png");
const userIcon = require("../assets/figma-nav-user.png");
const ordersIcon = require("../assets/figma-nav-receipt.png");
const cartIcon = require("../assets/home-icon-cart.png");
const homeIcon = require("../assets/figma-nav-home.png");

type BasketReviewLine = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  imageSource: ImageSourcePropType;
};

type Props = {
  sellerId: string;
  items: BasketReviewLine[];
  onBack: () => void;
  onReturnToComparison: () => void;
  onRemoveMissing: (ids: string[]) => void;
  onContinue: () => void;
  onLogin: () => void;
  onCart: () => void;
  onHome: () => void;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const sellers: Record<string, { title: string; distance: number; freeShipping: boolean }> = {
  "1": { title: "فروشگاه نمونه ۱ (محله رسالت)", distance: 1.2, freeShipping: true },
  "2": { title: "فروشگاه نمونه ۲", distance: 0.8, freeShipping: true },
  "3": { title: "فروشگاه نمونه ۳", distance: 2.4, freeShipping: false },
};

export function BuyerBasketReviewScreen({
  sellerId, items, onBack, onReturnToComparison, onRemoveMissing,
  onContinue, onLogin, onCart, onHome,
}: Props) {
  const seller = sellers[sellerId] ?? sellers["1"];
  const availableItems = sellerId === "3" ? items.slice(0, 1) : items;
  const missingItemIds = sellerId === "3"
    ? items.slice(1).map((item) => item.id)
    : [];
  const subtotal = availableItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity, 0,
  );
  const canContinue = availableItems.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8f5" />
      <View style={styles.fill}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="بازگشت به مقایسه فروشگاه‌ها"
            onPress={onBack}
            style={styles.headerBack}
          >
            <Image source={backIcon} style={styles.backIcon} accessibilityLabel="بازگشت" />
          </Pressable>
          <Text style={styles.headerTitle}>بررسی سبد</Text>
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sellerCard}>
            <Text style={styles.sellerEyebrow}>فروشگاه انتخاب شده شما</Text>
            <Text style={styles.sellerName}>{seller.title}</Text>
            <View style={styles.sellerMeta}>
              <Text style={styles.sellerDistance}>
                فاصله تا شما: {fa(seller.distance).replace("٫", ".")} کیلومتر
              </Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.sellerDispatch}>ارسال از فروشگاه انتخاب‌شده</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>لیست اقلام آماده ارسال</Text>
          {availableItems.length > 0 ? (
            <View style={styles.lines}>
              {availableItems.map((item) => (
                <View key={item.id} style={styles.lineCard}>
                  <View style={styles.lineCopy}>
                    <Text numberOfLines={1} style={styles.lineTitle}>{item.title}</Text>
                    <View style={styles.lineMeta}>
                      <Text style={styles.quantityText}>
                        تعداد: {fa(item.quantity)} {item.unit}
                      </Text>
                      <Text style={styles.dot}>•</Text>
                      <Text style={styles.linePrice}>
                        {fa(item.unitPrice * item.quantity)} تومان
                      </Text>
                    </View>
                  </View>
                  <Image
                    source={item.imageSource}
                    style={styles.lineImage}
                    resizeMode="cover"
                    accessibilityLabel={item.title}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>سبدی برای این فروشگاه باقی نمانده</Text>
              <Text style={styles.emptyCopy}>به مقایسه برگردید و فروشگاه دیگری را انتخاب کنید.</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onReturnToComparison}
              style={styles.returnButton}
            >
              <Text style={styles.returnText}>بازگشت به مقایسه</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: missingItemIds.length === 0 }}
              disabled={missingItemIds.length === 0}
              onPress={() => onRemoveMissing(missingItemIds)}
              style={[styles.removeButton, missingItemIds.length === 0 && styles.removeDisabled]}
            >
              <Text style={styles.removeText}>حذف کالای ناموجود</Text>
            </Pressable>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>{fa(subtotal)} تومان</Text>
              <Text style={styles.summaryLabel}>مجموع اقلام سبد:</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.shippingValue}>
                {seller.freeShipping ? "رایگان" : "پس از اعلام فروشگاه"}
              </Text>
              <Text style={styles.summaryLabel}>هزینه ارسال:</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalValue}>{fa(subtotal)} تومان</Text>
              <Text style={styles.totalLabel}>مبلغ قابل پرداخت:</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            disabled={!canContinue}
            onPress={onContinue}
            style={[styles.continueButton, !canContinue && styles.continueDisabled]}
          >
            <Text style={styles.continueText}>ادامه ثبت سفارش</Text>
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
            <Image source={cartIcon} style={[styles.navIcon, styles.cartActiveIcon]} accessibilityLabel="سبد خرید" />
            <Text style={[styles.navLabel, styles.navLabelActive]}>سبد</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={onHome}>
            <Image source={homeIcon} style={styles.navIcon} accessibilityLabel="خانه" />
            <Text style={styles.navLabel}>خانه</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

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
  scrollContent: {
    paddingHorizontal: 20, paddingBottom: 100, gap: 16, backgroundColor: "#faf8f5",
  },
  sellerCard: {
    padding: 14, gap: 8, alignItems: "flex-end", borderWidth: 1,
    borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff",
  },
  sellerEyebrow: { color: "#8e8e93", fontSize: 12, ...rtl },
  sellerName: { color: "#0f5b5a", fontSize: 16, fontWeight: "800", ...rtl },
  sellerMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  sellerDistance: { color: "#2d2d2d", fontSize: 12, ...rtl },
  sellerDispatch: { color: "#8e8e93", fontSize: 12, ...rtl },
  dot: { color: "#8e8e93", fontSize: 12 },
  sectionTitle: { width: "100%", color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  lines: { width: "100%", gap: 10 },
  lineCard: {
    width: "100%", padding: 10, flexDirection: "row-reverse", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff",
  },
  lineCopy: { flex: 1, minWidth: 0, alignItems: "flex-end", gap: 4 },
  lineTitle: { maxWidth: "100%", color: "#2d2d2d", fontSize: 13, fontWeight: "700", ...rtl },
  lineMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  quantityText: { color: "#8e8e93", fontSize: 11, ...rtl },
  linePrice: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  lineImage: { width: 54, height: 54, borderRadius: 8, backgroundColor: "#f0e7dd" },
  emptyCard: {
    width: "100%", padding: 16, gap: 8, borderWidth: 1, borderColor: "#f0e7dd",
    borderRadius: 12, backgroundColor: "#fff", alignItems: "flex-end",
  },
  emptyTitle: { color: "#2d2d2d", fontWeight: "700", fontSize: 14, ...rtl },
  emptyCopy: { color: "#8e8e93", fontSize: 12, ...rtl },
  actionsRow: { width: "100%", flexDirection: "row", gap: 12 },
  returnButton: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12,
    paddingVertical: 10, borderWidth: 1, borderColor: "#b5523b", borderRadius: 8, backgroundColor: "#fff",
  },
  returnText: { color: "#b5523b", fontSize: 11, fontWeight: "700", ...rtl },
  removeButton: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12,
    paddingVertical: 10, borderRadius: 8, backgroundColor: "#fdf1ee",
  },
  removeDisabled: { opacity: 0.72 },
  removeText: { color: "#b5523b", fontSize: 11, fontWeight: "700", ...rtl },
  summaryCard: {
    width: "100%", padding: 16, gap: 12, alignItems: "flex-end", borderWidth: 1,
    borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff",
  },
  summaryRow: { width: "100%", flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between" },
  summaryLabel: { color: "#8e8e93", fontSize: 14, ...rtl },
  summaryValue: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  shippingValue: { color: "#0f5b5a", fontSize: 14, fontWeight: "700", ...rtl },
  divider: { width: "100%", height: 1, backgroundColor: "#f0e7dd" },
  totalLabel: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  totalValue: { color: "#b5523b", fontSize: 16, fontWeight: "800", ...rtl },
  continueButton: {
    width: "100%", paddingHorizontal: 24, paddingVertical: 14, alignItems: "center",
    justifyContent: "center", borderRadius: 12, backgroundColor: "#0f5b5a",
  },
  continueDisabled: { opacity: 0.5 },
  continueText: { color: "#fff", fontSize: 15, fontWeight: "800", ...rtl },
  bottomNav: {
    height: 84, position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingTop: 10, paddingBottom: 20, flexDirection: "row-reverse",
    alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1,
    borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000",
    shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { width: 22, height: 22 },
  cartActiveIcon: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
