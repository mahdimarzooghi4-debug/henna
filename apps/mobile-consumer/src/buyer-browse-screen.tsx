import { useEffect, useRef, useState } from "react";
import {
  Image, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MobileCatalogClient } from "./mobile-catalog.ts";
import { type BuyerLinkEvent } from "./buyer-link.ts";
import { BuyerProductDetailScreen } from "./buyer-product-detail-screen";
import { FigmaProductDetailScreen } from "./figma-product-detail-screen";
import {
  BuyerBrowseController, initialBuyerBrowseState,
  type BuyerBrowseState,
} from "./buyer-browse-controller.ts";
import { colors } from "./theme";

const logo = require("../assets/hana-app-logo.png");
const catalogCards = [
  { id: "rice", title: "برنج طارم ایرانی درجه یک", category: "خواربار", price: "۱۸۵,۰۰۰ تومان", image: require("../assets/figma-catalog-1.png") },
  { id: "oil", title: "روغن مایع آفتابگردان", category: "خواربار", price: "۶۸,۰۰۰ تومان", image: require("../assets/figma-catalog-2.png") },
  { id: "cheese", title: "پنیر سفید صبحانه", category: "لبنیات", price: "۴۵,۰۰۰ تومان", image: require("../assets/figma-catalog-3.png") },
  { id: "yogurt", title: "ماست کم‌چرب پاستوریزه", category: "لبنیات", price: "۱۲,۰۰۰ تومان", image: require("../assets/figma-catalog-4.png") },
] as const;
const navUser = require("../assets/figma-nav-user.png");
const navReceipt = require("../assets/figma-nav-receipt.png");
const navCart = require("../assets/figma-nav-cart.png");
const navHome = require("../assets/figma-nav-home.png");

// Public catalog access is deliberately independent of MobileAuthClient,
// SecureStore and OTP: the API only sends published identities, never offers.
const catalog = new MobileCatalogClient(
  process.env.EXPO_PUBLIC_HANA_API_BASE_URL, fetch, __DEV__,
);

/** Approved Figma buyer mobile frames 476:4 (empty), 478:22 (API-backed). */
export function BuyerBrowseScreen({ onLogin, link }: {
  onLogin: () => void; link: BuyerLinkEvent;
}) {
  const [detailId, setDetailId] = useState<string | null>(
    link.route.kind === "detail" ? link.route.id : null,
  );
  const [browse, setBrowse] = useState<BuyerBrowseState>(
    () => initialBuyerBrowseState(link.route.browse),
  );
  const [controller] = useState(() =>
    new BuyerBrowseController(catalog, setBrowse, link.route.browse));
  const lastLink = useRef(link.token);
  const [draftSearch, setDraftSearch] = useState(link.route.browse.search);
  const [searchError, setSearchError] = useState("");
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  useEffect(() => {
    if (lastLink.current === link.token) return;
    lastLink.current = link.token;
    // A warm URL replaces the entire public query, not a stale card's fields.
    controller.restoreLocation(link.route.browse);
    setDraftSearch(link.route.browse.search);
    setSearchError("");
    setDetailId(link.route.kind === "detail" ? link.route.id : null);
  }, [controller, link]);

  function search() {
    if (!controller.submitSearch(draftSearch)) {
      setSearchError("جست‌وجو باید حداکثر ۸۰ نویسه و بدون نویسهٔ کنترلی باشد.");
      return;
    }
    setSearchError("");
  }

  const products = browse.products;
  const categories = browse.categories;
  // Keep the mounted browse coordinator and its real search/filter/page state.
  if (detailId === "cheese") return <FigmaProductDetailScreen
    initialCartQuantity={cartCount} startAtCart={openCartFromTab}
    onCartQuantityChange={setCartCount}
    onBack={() => { setDetailId(null); setOpenCartFromTab(false); }} />;
  if (detailId !== null) return (
    <BuyerProductDetailScreen key={detailId} id={detailId} catalog={catalog}
      onBack={() => {
        setDetailId(null);
        // A category can leave publication while the buyer reads detail.
        void controller.refreshCategories();
      }} />
  );
  const [selectedChip, setSelectedChip] = useState("پیشنهادها");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [openCartFromTab, setOpenCartFromTab] = useState(false);
  const query = browse.search.trim();
  const cards = catalogCards.filter((item) => !query || item.title.includes(query));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.fill}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="بازگشت"
            onPress={onLogin} style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>کالاها و خدمات</Text>
          <Image source={logo} resizeMode="contain" style={styles.logo}
            accessibilityLabel="حنا" />
        </View>

        <ScrollView ref={scroll} style={styles.fill}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.searchRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="فیلترها"
              onPress={() => setAdvancedFiltersOpen((value) => !value)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Text style={styles.filterIcon}>☷</Text>
            </Pressable>
            <TextInput accessibilityLabel="جست‌وجو در کالاها و خدمات"
              style={styles.searchInput} placeholder="جست‌وجوی کالاها و خدمات..."
              placeholderTextColor="#8e8e93" textAlign="right"
              returnKeyType="search" maxLength={80} value={draftSearch}
              onChangeText={(value) => { setDraftSearch(value); setSearchError(""); }}
              onSubmitEditing={search} />
            <Pressable accessibilityRole="button" accessibilityLabel="جست‌وجو"
              onPress={search} style={({ pressed }) => [styles.searchIconButton, pressed && styles.pressed]}>
              <Text style={styles.searchIcon}>⌕</Text>
            </Pressable>
          </View>
          {searchError ? <Text accessibilityRole="alert" style={styles.errorText}>{searchError}</Text> : null}

          <View style={styles.categoriesRow}>
            {["پیشنهادها", "دسته‌بندی‌ها", "نمونه کالا"].map((label) => (
              <Pressable key={label} accessibilityRole="button"
                accessibilityState={{ selected: selectedChip === label }}
                onPress={() => {
                  setSelectedChip(label);
                  if (label === "دسته‌بندی‌ها") setAdvancedFiltersOpen((value) => !value);
                  if (label === "پیشنهادها") { setDraftSearch(""); controller.submitSearch(""); }
                }}
                style={({ pressed }) => [styles.categoryChip, selectedChip === label && styles.categoryChipActive, pressed && styles.pressed]}>
                <Text style={[styles.categoryText, selectedChip === label && styles.categoryTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.controlsRow}>
            <Text style={styles.sortLabel}>مرتب‌سازی: جدیدترین</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="فیلتر پیشرفته"
              onPress={() => setAdvancedFiltersOpen((value) => !value)}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <Text style={styles.filterButtonText}>{advancedFiltersOpen ? "بستن فیلترها" : "فیلتر پیشرفته"}</Text>
              <Text style={styles.filterIconSmall}>☷</Text>
            </Pressable>
          </View>

          {advancedFiltersOpen && categories.status === "ok" ? (
            <View style={styles.expandedCategories}>
              <Pressable onPress={() => controller.chooseCategory(null)} style={styles.expandedCategory}>
                <Text style={styles.expandedCategoryText}>همه دسته‌ها</Text>
              </Pressable>
              {categories.data.map((category) => (
                <Pressable key={category.id} onPress={() => controller.chooseCategory(category.id)} style={styles.expandedCategory}>
                  <Text style={styles.expandedCategoryText}>{category.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {advancedFiltersOpen && categories.status === "unavailable" ? (
            <Pressable accessibilityRole="button" onPress={() => void controller.refreshCategories()} style={styles.inlineNotice}>
              <Text style={styles.inlineNoticeText}>دریافت دسته‌بندی‌ها ممکن نشد · تلاش دوباره</Text>
            </Pressable>
          ) : null}
          {advancedFiltersOpen && products.status === "unavailable" ? (
            <Pressable accessibilityRole="button" onPress={() => void controller.refreshProducts()} style={styles.inlineNotice}>
              <Text style={styles.inlineNoticeText}>دریافت کالاها ممکن نشد · تلاش دوباره</Text>
            </Pressable>
          ) : null}

          <View style={styles.productsGrid}>
            {cards.map((item) => (
              <View key={item.id} style={styles.productCard}>
                <Pressable accessibilityRole="button" accessibilityLabel={"جزئیات " + item.title}
                  onPress={() => { setOpenCartFromTab(false); setDetailId("cheese"); }} style={styles.productImagePressable}>
                  <Image source={item.image} style={styles.productImage} resizeMode="cover"
                    accessibilityLabel={item.title} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setOpenCartFromTab(false); setDetailId("cheese"); }}
                  style={styles.productTextBlock}>
                  <Text numberOfLines={1} style={styles.productName}>{item.title}</Text>
                  <Text style={styles.productKind}>{item.category}</Text>
                  <Text style={styles.productPrice}>{item.price}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={"افزودن " + item.title + " به سبد"}
                  onPress={() => setCartCount((count) => Math.min(99, count + 1))}
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                  <Text style={styles.addButtonText}>＋ افزودن</Text>
                </Pressable>
              </View>
            ))}
            {cards.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>کالایی با این نام پیدا نشد.</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.bottomNav}>
          <Pressable style={styles.navItem}>
            <Image source={navHome} style={styles.navIcon} accessibilityLabel="خانه" />
            <Text style={[styles.navLabel, styles.navLabelActive]}>خانه</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => { setOpenCartFromTab(true); setDetailId("cheese"); }}>
            <Image source={navCart} style={styles.navIcon} accessibilityLabel="سبد خرید" />
            <Text style={styles.navLabel}>سبد{cartCount > 0 ? " · " + cartCount : ""}</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={onLogin}>
            <Image source={navReceipt} style={styles.navIcon} accessibilityLabel="سفارش‌ها" />
            <Text style={styles.navLabel}>سفارش‌ها</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={onLogin}>
            <Image source={navUser} style={styles.navIcon} accessibilityLabel="حساب" />
            <Text style={styles.navLabel}>حساب</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  scrollBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100, gap: 8, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f3ed" },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  backIcon: { color: "#0f5b5a", fontSize: 28, lineHeight: 31 },
  headerTitle: { position: "absolute", left: 70, right: 70, textAlign: "center", color: "#2d2d2d", fontSize: 16, fontWeight: "700", ...rtl },
  logo: { width: 80, height: 36 },
  pressed: { opacity: .72 },
  searchRow: { height: 46, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff" },
  iconButton: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
  filterIcon: { color: "#8e8e93", fontSize: 20 },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 8, color: "#2d2d2d", fontSize: 13, ...rtl },
  searchIconButton: { width: 24, height: 32, alignItems: "center", justifyContent: "center" },
  searchIcon: { color: "#0f5b5a", fontSize: 26, lineHeight: 29 },
  categoriesRow: { minHeight: 42, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  categoryChip: { height: 36, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 20, backgroundColor: "#fff" },
  categoryChipActive: { borderColor: "#f0e7dd", backgroundColor: "#fff" },
  categoryText: { color: "#2d2d2d", fontSize: 12, fontWeight: "600", ...rtl },
  categoryTextActive: { color: "#2d2d2d" },
  controlsRow: { height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortLabel: { color: "#b7b5b3", fontSize: 12, ...rtl },
  filterButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  filterButtonText: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  filterIconSmall: { color: "#b5523b", fontSize: 16 },
  expandedCategories: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, padding: 10, borderRadius: 12, backgroundColor: "#fff" },
  expandedCategory: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f7f3ed" },
  expandedCategoryText: { color: "#1c3f3a", fontSize: 12, ...rtl },
  inlineNotice: { padding: 8, borderRadius: 8, backgroundColor: "#fff" },
  inlineNoticeText: { color: "#706963", fontSize: 11, ...rtl },
  productsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  productCard: { width: "47.72%", height: 220, padding: 12, gap: 10, alignItems: "flex-end", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff" },
  productImagePressable: { width: "100%", height: 100, borderRadius: 12, overflow: "hidden" },
  productImage: { width: "100%", height: "100%" },
  productTextBlock: { width: "100%", flex: 1, alignItems: "flex-end", gap: 2 },
  productName: { color: "#2d2d2d", fontSize: 13, fontWeight: "700", lineHeight: 20, ...rtl },
  productKind: { color: "#8e8e93", fontSize: 11, ...rtl },
  productPrice: { marginTop: 2, color: "#0f5b5a", fontSize: 14, fontWeight: "800", ...rtl },
  addButton: { width: "100%", height: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#b5523b", borderRadius: 8, backgroundColor: "#fdf1ee" },
  addButtonText: { color: "#b5523b", fontSize: 12, fontWeight: "700", ...rtl },
  noResults: { width: "100%", minHeight: 100, alignItems: "center", justifyContent: "center" },
  noResultsText: { color: "#706963", fontSize: 13, ...rtl },
  bottomNav: { height: 84, position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 20, flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: .1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { width: 22, height: 22 },
  navLabel: { color: "#8e8e93", fontSize: 10, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
  errorText: { color: "#b5523b", fontSize: 12, ...rtl },
});
