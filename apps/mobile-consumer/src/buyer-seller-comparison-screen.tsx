import { useMemo, useState } from "react";
import {
  Image, Pressable, ScrollView, StatusBar, StyleSheet, View
} from "react-native";
import { Text } from "./typography";
import { SafeAreaView } from "react-native-safe-area-context";

const logo = require("../assets/home-logo-badge.png");
const backIcon = require("../assets/home-icon-arrow-left.png");
const userIcon = require("../assets/figma-nav-user.png");
const ordersIcon = require("../assets/figma-nav-receipt.png");
const cartIcon = require("../assets/figma-nav-cart.png");
const homeIcon = require("../assets/figma-nav-home.png");

type SortKey = "price" | "basket" | "distance" | "delivery";
type SellerExample = {
  id: string;
  title: string;
  distance: number;
  available: number;
  totalItems: number;
  basketPrice: number;
  badges: Array<{ label: string; tone: "teal" | "terracotta" }>;
};

const sellerExamples: SellerExample[] = [
  {
    id: "3",
    title: "فروشگاه نمونه ۳",
    distance: 2.4,
    available: 1,
    totalItems: 2,
    basketPrice: 260000,
    badges: [
      { label: "کمترین قیمت کل", tone: "teal" },
      { label: "۱ کالا ناموجود", tone: "terracotta" },
    ],
  },
  {
    id: "1",
    title: "فروشگاه نمونه ۱",
    distance: 1.2,
    available: 2,
    totalItems: 2,
    basketPrice: 265000,
    badges: [{ label: "کامل‌ترین سبد", tone: "teal" }],
  },
  {
    id: "2",
    title: "فروشگاه نمونه ۲",
    distance: 0.8,
    available: 2,
    totalItems: 2,
    basketPrice: 270000,
    badges: [{ label: "نزدیک‌ترین", tone: "teal" }],
  },
];

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

type Props = {
  onBack: () => void;
  onLogin: () => void;
  onCart: () => void;
  onHome: () => void;
  onSelectSeller: (sellerId: string) => void;
};

export function BuyerSellerComparisonScreen({
  onBack, onLogin, onCart, onHome, onSelectSeller,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("price");

  const sellers = useMemo(() => {
    const sorted = [...sellerExamples];
    if (sortKey === "basket") {
      sorted.sort((a, b) =>
        (b.available / b.totalItems) - (a.available / a.totalItems) ||
        a.basketPrice - b.basketPrice);
    } else if (sortKey === "distance") {
      sorted.sort((a, b) => a.distance - b.distance);
    } else {
      sorted.sort((a, b) => a.basketPrice - b.basketPrice);
    }
    return sorted;
  }, [sortKey]);

  const filters: Array<{ key: SortKey; label: string; disabled?: boolean }> = [
    { key: "delivery", label: "زمان تحویل", disabled: true },
    { key: "distance", label: "نزدیک‌ترین" },
    { key: "basket", label: "کامل‌ترین سبد" },
    { key: "price", label: "قیمت کل" },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.fill}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="بازگشت به سبد خرید"
            onPress={onBack}
            style={styles.headerBack}
          >
            <Image source={backIcon} style={styles.backIcon} accessibilityLabel="بازگشت" />
          </Pressable>
          <Text style={styles.headerTitle}>مقایسه فروشگاه‌ها</Text>
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Text style={styles.introEyebrow}>فروشگاه‌های نزدیک</Text>
            <Text style={styles.introTitle}>برای همین سبد، فروشگاه را انتخاب کنید.</Text>
          </View>

          <View style={styles.filterCard}>
            {filters.map((filter) => {
              const active = sortKey === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: filter.disabled }}
                  disabled={filter.disabled}
                  onPress={() => setSortKey(filter.key)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                    filter.disabled && styles.filterChipDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                      filter.disabled && styles.filterTextDisabled,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sellerList}>
            {sellers.map((seller) => (
              <View key={seller.id} style={styles.sellerCard}>
                <View style={styles.sellerHeader}>
                  <View style={styles.badges}>
                    {seller.badges.map((badge) => (
                      <View
                        key={badge.label}
                        style={[
                          styles.badge,
                          badge.tone === "teal" ? styles.badgeTeal : styles.badgeTerracotta,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            badge.tone === "teal" ? styles.badgeTextTeal : styles.badgeTextTerracotta,
                          ]}
                        >
                          {badge.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.sellerName}>{seller.title}</Text>
                </View>

                <View style={styles.sellerDetails}>
                  <View style={styles.availabilityRow}>
                    <Text style={styles.availabilityText}>
                      {fa(seller.available)} از {fa(seller.totalItems)} کالا موجود
                    </Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.distanceText}>
                      {fa(seller.distance).replace("٫", ".")} کیلومتر
                    </Text>
                  </View>
                  <View style={styles.deliveryDetails}>
                    <Text style={styles.detailText}>زمان تحویل: پس از انتخاب فروشگاه مشخص می‌شود</Text>
                    <Text style={styles.detailText}>هزینه ارسال: هنگام نهایی‌سازی محاسبه می‌شود</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.sellerFooter}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"انتخاب " + seller.title}
                    onPress={() => onSelectSeller(seller.id)}
                    style={styles.selectButton}
                  >
                    <Text style={styles.selectButtonText}>
                      انتخاب این فروشگاه
                    </Text>
                  </Pressable>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>قیمت کل سبد:</Text>
                    <Text style={styles.priceAmount}>{fa(seller.basketPrice)} تومان</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
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
            <Image source={cartIcon} style={[styles.navIcon, styles.navIconActive]} accessibilityLabel="سبد خرید" />
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
  safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  header: {
    height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f3ed",
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
    paddingHorizontal: 20, paddingBottom: 100, gap: 16, backgroundColor: "#f7f3ed",
  },
  introCard: {
    padding: 12, gap: 4, alignItems: "flex-end", borderWidth: 1,
    borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff",
  },
  introEyebrow: { color: "#8e8e93", fontSize: 13, ...rtl },
  introTitle: { color: "#2d2d2d", fontSize: 15, fontWeight: "700", ...rtl },
  filterCard: {
    minHeight: 54, padding: 12, flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "flex-start", gap: 8, borderWidth: 1, borderColor: "#f0e7dd",
    borderRadius: 12, backgroundColor: "#fff",
  },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#f0e7dd",
    borderRadius: 8, backgroundColor: "#fff", elevation: 1,
  },
  filterChipActive: { borderColor: "#b5523b", backgroundColor: "#fdf1ee" },
  filterChipDisabled: { opacity: 0.45 },
  filterText: { color: "#8e8e93", fontSize: 11, fontWeight: "600", ...rtl },
  filterTextActive: { color: "#b5523b" },
  filterTextDisabled: { color: "#8e8e93" },
  sellerList: { gap: 16 },
  sellerCard: {
    padding: 16, gap: 12, alignItems: "flex-end", borderWidth: 1,
    borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff",
  },
  sellerHeader: {
    width: "100%", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", gap: 8,
  },
  badges: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTeal: { backgroundColor: "#e8f2f2" },
  badgeTerracotta: { backgroundColor: "#fdf1ee" },
  badgeText: { fontSize: 11, fontWeight: "600", ...rtl },
  badgeTextTeal: { color: "#0f5b5a" },
  badgeTextTerracotta: { color: "#b5523b" },
  sellerName: { color: "#2d2d2d", fontSize: 15, fontWeight: "700", ...rtl },
  sellerDetails: { width: "100%", alignItems: "flex-end", gap: 6 },
  availabilityRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  availabilityText: { color: "#0f5b5a", fontSize: 12, fontWeight: "600", ...rtl },
  dot: { color: "#8e8e93", fontSize: 12 },
  distanceText: { color: "#2d2d2d", fontSize: 12, ...rtl },
  deliveryDetails: { width: "100%", alignItems: "flex-end", gap: 4 },
  detailText: { color: "#8e8e93", fontSize: 12, ...rtl },
  divider: { width: "100%", height: 1, backgroundColor: "#f0e7dd" },
  sellerFooter: {
    width: "100%", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", gap: 8,
  },
  selectButton: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "#0f5b5a",
  },
  selectButtonText: { color: "#fff", fontSize: 12, fontWeight: "700", ...rtl },
  priceRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  priceLabel: { color: "#8e8e93", fontSize: 11, ...rtl },
  priceAmount: { color: "#b5523b", fontSize: 16, fontWeight: "800", ...rtl },
  bottomNav: {
    height: 84, position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingTop: 10, paddingBottom: 20, flexDirection: "row-reverse",
    alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1,
    borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000",
    shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navIconActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
