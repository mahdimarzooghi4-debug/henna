import { useState } from "react";
import {
  Image, ImageBackground, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buyerHomeCategories, buyerHomeProducts } from "./buyer-home-data";

const logo = require("../assets/home-logo-badge.png");
const hero = require("../assets/home-hero-card.jpg");
const bellIcon = require("../assets/home-icon-bell.png");
const slidersIcon = require("../assets/home-icon-sliders.png");
const searchIcon = require("../assets/home-icon-search.png");
const arrowIcon = require("../assets/home-icon-arrow-left.png");
const infoIcon = require("../assets/home-icon-info.png");
const plusIcon = require("../assets/home-icon-plus.png");
const userIcon = require("../assets/home-icon-user.png");
const receiptIcon = require("../assets/home-icon-receipt.png");
const cartIcon = require("../assets/home-icon-cart.png");
const homeIcon = require("../assets/home-icon-home.png");

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

type Props = {
  cartCount: number;
  notice: string;
  onBrowse: (search?: string) => void;
  onAdd: (id: string, title: string) => void;
  onProduct: (id: string) => void;
  onCart: () => void;
  onLogin: () => void;
  onHome: () => void;
};

export function BuyerHomeScreen({
  cartCount, notice, onBrowse, onAdd, onProduct, onCart, onLogin, onHome,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedChip, setSelectedChip] = useState("کالابرگ");
  const chips = [
    { label: "طرح ویژه", mark: "🔥" },
    { label: "کالابرگ", mark: "✓" },
    { label: "تخفیف‌دار", mark: "٪" },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.fill}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="اعلان‌ها" style={styles.notification}>
            <Image source={bellIcon} style={styles.bellIcon} accessibilityLabel="اعلان‌ها" />
          </Pressable>
          <View style={styles.brandGroup}>
            <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
            <View style={styles.greeting}>
              <Text style={styles.greetingTop}>سلام، روزت بخیر</Text>
              <Text style={styles.greetingBottom}>به حنا خوش آمدید</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="فیلترها"
              onPress={() => onBrowse(search)} style={styles.smallIconButton}>
              <Image source={slidersIcon} style={styles.smallIcon} accessibilityLabel="فیلترها" />
            </Pressable>
            <TextInput accessibilityLabel="جست‌وجوی کالا یا دسته"
              style={styles.searchInput} placeholder="جست‌وجوی کالا یا دسته..."
              placeholderTextColor="#8e8e93" textAlign="right" value={search}
              returnKeyType="search" onChangeText={setSearch}
              onSubmitEditing={() => onBrowse(search.trim())} />
            <Pressable accessibilityRole="button" accessibilityLabel="جست‌وجو"
              onPress={() => onBrowse(search.trim())} style={styles.searchButton}>
              <Image source={searchIcon} style={styles.smallIcon} accessibilityLabel="جست‌وجو" />
            </Pressable>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {chips.map((chip) => (
            <Pressable key={chip.label} accessibilityRole="button"
              accessibilityState={{ selected: selectedChip === chip.label }}
              onPress={() => setSelectedChip(chip.label)}
              style={[styles.chip, selectedChip === chip.label && styles.chipActive]}>
              <Text style={[styles.chipText, selectedChip === chip.label && styles.chipTextActive]}>
                {chip.label} <Text style={[styles.chipMark, selectedChip === chip.label && styles.chipMarkActive]}>{chip.mark}</Text>
              </Text>
            </Pressable>
          ))}
        </View>

        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ImageBackground source={hero} resizeMode="cover" imageStyle={styles.heroImage}
            style={styles.heroCard}>
            <View pointerEvents="none" style={styles.heroTint} />
            <Text style={styles.heroTitle}>خرید روزمره، با اثری فراتر از خرید</Text>
            <Text style={styles.heroCopy}>کالاها و نیازهای خود را انتخاب کن؛ حنا مناسب‌ترین گزینه‌های نزدیک را برایت پیدا و مقایسه می‌کند.</Text>
            <View style={styles.heroActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="مشاهده پیشنهادها"
                onPress={() => onBrowse("")} style={styles.heroArrow}>
                <Image source={arrowIcon} style={styles.heroArrowIcon} accessibilityLabel="مشاهده پیشنهادها" />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => onBrowse("")} style={styles.heroButton}>
                <Text style={styles.heroButtonText}>تخفیف‌ها و طرح‌ها</Text>
              </Pressable>
            </View>
          </ImageBackground>

          <View style={styles.guidance}>
            <Text style={styles.guidanceText}>انتخابت را کامل کن؛ حنا گزینه‌های نزدیک را برایت مقایسه می‌کند.</Text>
            <View style={styles.infoBox}>
              <Image source={infoIcon} style={styles.infoIcon} accessibilityLabel="راهنما" />
            </View>
          </View>

          <View style={styles.offersSection}>
            <View style={styles.sectionHeader}>
              <Pressable accessibilityRole="button" onPress={() => onBrowse("")}>
                <Text style={styles.sectionAction}>همه پیشنهادها</Text>
              </Pressable>
              <Text style={styles.sectionTitle}>پیشنهادهای امروز</Text>
            </View>
            <ScrollView horizontal inverted showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productCarousel}>
              {buyerHomeProducts.map((item) => (
                <View key={item.id} style={styles.productCard}>
                  <Pressable accessibilityRole="button" accessibilityLabel={"جزئیات " + item.title}
                    onPress={() => onProduct(item.id)} style={styles.productImageWrap}>
                    <Image source={item.image} style={styles.productImage} resizeMode="cover"
                      accessibilityLabel={item.title} />
                    <View style={styles.productBadge}>
                      <Text style={styles.productBadgeText}>{item.badge}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.productSpacer} />
                  <Pressable accessibilityRole="button" onPress={() => onProduct(item.id)} style={styles.productCopy}>
                    <Text numberOfLines={1} style={styles.productName}>{item.title}</Text>
                    <Text style={styles.productPrice}>{item.price}</Text>
                    {item.oldPrice ? <Text style={styles.productOldPrice}>{item.oldPrice}</Text> : <View style={styles.productOldSpacer} />}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={"افزودن " + item.title + " به سبد"}
                    onPress={() => onAdd(item.id, item.title)} style={styles.addButton}>
                    <Text style={styles.addButtonText}>افزودن</Text>
                    <Image source={plusIcon} style={styles.plusIcon} accessibilityLabel="افزودن" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => onBrowse("")} style={styles.viewAllOffers}>
              <Text style={styles.sectionAction}>مشاهده همه</Text>
            </Pressable>
          </View>

          <View style={styles.categoriesSection}>
            <View style={styles.sectionHeader}>
              <Pressable accessibilityRole="button" onPress={() => onBrowse("")}>
                <Text style={styles.sectionAction}>مشاهده همه</Text>
              </Pressable>
              <Text style={styles.categoriesTitle}>دسته‌بندی‌های محبوب</Text>
            </View>
            <View style={styles.categoriesRow}>
              {buyerHomeCategories.map((item) => (
                <Pressable key={item.title} accessibilityRole="button"
                  accessibilityLabel={"دسته‌بندی " + item.title}
                  onPress={() => onBrowse(item.title)} style={styles.categoryItem}>
                  <Image source={item.image} style={styles.categoryImage} resizeMode="cover"
                    accessibilityLabel={item.title} />
                  <Text style={styles.categoryLabel}>{item.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomNav}>
          <Pressable style={styles.navItem} accessibilityRole="button" onPress={onLogin}>
            <Image source={userIcon} style={styles.navIcon} accessibilityLabel="حساب" />
            <Text style={styles.navLabel}>حساب</Text>
          </Pressable>
          <Pressable style={styles.navItem} accessibilityRole="button" onPress={onLogin}>
            <Image source={receiptIcon} style={styles.navIcon} accessibilityLabel="سفارش‌ها" />
            <Text style={styles.navLabel}>سفارش‌ها</Text>
          </Pressable>
          <Pressable style={styles.navItem} accessibilityRole="button" onPress={onCart}
            accessibilityLabel={"سبد خرید" + (cartCount > 0 ? "، " + fa(cartCount) + " قلم" : "")}>
            <View>
              <Image source={cartIcon} style={styles.navIcon} accessibilityLabel="سبد" />
              {cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{fa(cartCount)}</Text></View> : null}
            </View>
            <Text style={styles.navLabel}>سبد</Text>
          </Pressable>
          <Pressable style={styles.navItem} accessibilityRole="button"
            accessibilityState={{ selected: true }} onPress={onHome}>
            <Image source={homeIcon} style={styles.navIcon} accessibilityLabel="خانه" />
            <Text style={[styles.navLabel, styles.navLabelActive]}>خانه</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  header: { height: 63, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  notification: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 20, backgroundColor: "#fff" },
  bellIcon: { width: 20, height: 20 },
  brandGroup: { flexDirection: "row-reverse", alignItems: "center", gap: 16 },
  logo: { width: 119, height: 47 },
  greeting: { width: 101, alignItems: "flex-end", gap: 2 },
  greetingTop: { color: "#8e8e93", fontSize: 11, fontWeight: "500", lineHeight: 16, ...rtl },
  greetingBottom: { color: "#2d2d2d", fontSize: 12, fontWeight: "700", lineHeight: 17, ...rtl },
  searchWrap: { paddingHorizontal: 20, paddingVertical: 8 },
  searchBar: { height: 46, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff" },
  smallIconButton: { width: 24, height: 28, alignItems: "center", justifyContent: "center" },
  smallIcon: { width: 18, height: 18 },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 10, color: "#2d2d2d", fontSize: 13, ...rtl },
  searchButton: { width: 24, height: 28, alignItems: "center", justifyContent: "center" },
  chipsRow: { minHeight: 42, marginHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  chip: { height: 34, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 20, backgroundColor: "#fff" },
  chipActive: { borderColor: "#0f5b5a", backgroundColor: "#0f5b5a" },
  chipText: { color: "#2d2d2d", fontSize: 12, fontWeight: "600", ...rtl },
  chipTextActive: { color: "#fff" },
  chipMark: { color: "#b5523b", fontSize: 12, fontWeight: "700" },
  chipMarkActive: { color: "#fff" },
  notice: { marginHorizontal: 20, color: "#0f5b5a", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100, gap: 20 },
  heroCard: { width: "100%", minHeight: 158, padding: 18, alignItems: "flex-end", gap: 8, overflow: "hidden", borderRadius: 20, justifyContent: "flex-start" },
  heroImage: { borderRadius: 20 },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,91,90,0.85)", borderRadius: 20 },
  heroTitle: { width: "100%", color: "#fff", fontSize: 20, lineHeight: 29, fontWeight: "800", ...rtl },
  heroCopy: { width: "100%", color: "#f0e7dd", fontSize: 13, lineHeight: 20, ...rtl },
  heroActions: { width: "100%", paddingTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroArrow: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#fff" },
  heroArrowIcon: { width: 14, height: 14 },
  heroButton: { minHeight: 28, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#b5523b" },
  heroButtonText: { color: "#fff", fontSize: 11, fontWeight: "800", ...rtl },
  guidance: { minHeight: 64, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#0f5b5a", borderRadius: 12, backgroundColor: "#e8f2f2" },
  guidanceText: { flex: 1, color: "#0f5b5a", fontSize: 13, lineHeight: 20, fontWeight: "600", ...rtl },
  infoBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#fff" },
  infoIcon: { width: 16, height: 16 },
  offersSection: { width: "100%", gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", minHeight: 24 },
  sectionAction: { color: "#b5523b", fontSize: 12, fontWeight: "700", ...rtl },
  sectionTitle: { color: "#2d2d2d", fontSize: 15, fontWeight: "800", ...rtl },
  productCarousel: { gap: 10 },
  productCard: { width: 140, height: 240, padding: 12, gap: 8, alignItems: "flex-end", justifyContent: "flex-end", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  productImageWrap: { width: "100%", height: 100, borderRadius: 12, overflow: "hidden" },
  productImage: { width: "100%", height: "100%" },
  productBadge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#b5523b" },
  productBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600", ...rtl },
  productSpacer: { height: 12, width: "100%" },
  productCopy: { width: "100%", alignItems: "flex-end", gap: 3 },
  productName: { width: "100%", color: "#2d2d2d", fontSize: 12, fontWeight: "600", lineHeight: 17, ...rtl },
  productPrice: { color: "#0f5b5a", fontSize: 12, fontWeight: "700", lineHeight: 17, ...rtl },
  productOldPrice: { color: "#8e8e93", fontSize: 10, lineHeight: 15, textDecorationLine: "line-through", ...rtl },
  productOldSpacer: { height: 15, width: "100%" },
  addButton: { width: "100%", height: 32, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: "#b5523b", borderRadius: 8, backgroundColor: "#fdf1ee" },
  addButtonText: { color: "#b5523b", fontSize: 11, fontWeight: "600", ...rtl },
  plusIcon: { width: 12, height: 12 },
  viewAllOffers: { alignSelf: "flex-start", marginTop: -2 },
  categoriesSection: { width: "100%", gap: 12 },
  categoriesTitle: { color: "#1c3f3a", fontSize: 15, fontWeight: "800", ...rtl },
  categoriesRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  categoryItem: { width: "23.28%", alignItems: "center", gap: 8 },
  categoryImage: { width: 64, height: 64, borderWidth: 1, borderColor: "#eae6e1", borderRadius: 32 },
  categoryLabel: { color: "#1c3f3a", fontSize: 14, lineHeight: 21, fontWeight: "600", textAlign: "center", writingDirection: "rtl" },
  bottomNav: { height: 84, position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
  cartBadge: { position: "absolute", top: -6, right: -7, minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#b5523b" },
  cartBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700", textAlign: "center" },
});
