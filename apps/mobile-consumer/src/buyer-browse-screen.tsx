import { useEffect, useRef, useState } from "react";
import {
  Image, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MobileCatalogClient } from "./mobile-catalog.ts";
import { BuyerHomeScreen } from "./buyer-home-screen";
import { buyerHomeProducts } from "./buyer-home-data";
import { type BuyerLinkEvent } from "./buyer-link.ts";
import { BuyerProductDetailScreen } from "./buyer-product-detail-screen";
import { FigmaProductDetailScreen } from "./figma-product-detail-screen";
import {
  BuyerBrowseController, initialBuyerBrowseState,
  type BuyerBrowseState,
} from "./buyer-browse-controller.ts";
import { colors } from "./theme";

const logo = require("../assets/hana-app-logo.png");
const catalogCards = buyerHomeProducts;
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
export function BuyerBrowseScreen({ onLogin, link, homeMode = false, onEnterCatalog, onHome }: {
  onLogin: () => void; link: BuyerLinkEvent; homeMode?: boolean;
  onEnterCatalog?: () => void; onHome?: () => void;
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
  const [selectedChip, setSelectedChip] = useState("پیشنهادها");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutRecipient, setCheckoutRecipient] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);

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
    setCartOpen(false);
    setCheckoutOpen(false);
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
  const cartItems = catalogCards.filter((item) => (cart[item.id] ?? 0) > 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.amount * (cart[item.id] ?? 0), 0);
  function setCartItemQuantity(id: string, quantity: number) {
    setCart((items) => {
      const next = { ...items };
      if (quantity <= 0) delete next[id];
      else next[id] = Math.min(99, quantity);
      return next;
    });
  }

  function enterCatalog(searchTerm = "") {
    setDraftSearch(searchTerm);
    controller.submitSearch(searchTerm);
    setSearchError("");
    onEnterCatalog?.();
  }

  if (homeMode && !cartOpen && !checkoutOpen && detailId === null) return (
    <BuyerHomeScreen cartCount={cartCount} notice={cartNotice}
      onBrowse={enterCatalog}
      onAdd={(id, title) => {
        setCartItemQuantity(id, (cart[id] ?? 0) + 1);
        setCartNotice(title + " به سبد اضافه شد.");
      }}
      onProduct={(id) => {
        setDetailId(id);
        onEnterCatalog?.();
      }}
      onCart={() => setCartOpen(true)} onLogin={onLogin}
      onHome={() => onHome?.()} />
  );
  // Keep the mounted browse coordinator and its real search/filter/page state.
  if (cartOpen) return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به فروشگاه"
          onPress={() => setCartOpen(false)} style={styles.headerBack}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>سبد خرید</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.cartScroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.cartHeadingRow}>
          <Text style={styles.cartPageTitle}>سبد خرید</Text>
          <Text style={styles.cartPageCount}>{fa(cartCount)} قلم</Text>
        </View>
        {cartItems.length === 0 ? (
          <View style={styles.cartEmptyCard}>
            <Image source={navCart} style={styles.cartEmptyIcon} accessibilityLabel="سبد خالی" />
            <Text style={styles.cartEmptyTitle}>سبد خرید شما خالی است</Text>
            <Text style={styles.cartEmptyCopy}>برای شروع خرید، کالاهای موردنیازتان را به سبد اضافه کنید.</Text>
            <Pressable accessibilityRole="button" onPress={() => setCartOpen(false)} style={styles.cartContinueButton}>
              <Text style={styles.cartContinueText}>مشاهده کالاها</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.cartLines}>
              {cartItems.map((item) => {
                const quantity = cart[item.id] ?? 0;
                return (
                  <View key={item.id} style={styles.cartLine}>
                    <Image source={item.image} style={styles.cartLineImage} resizeMode="cover" accessibilityLabel={item.title} />
                    <View style={styles.cartLineCopy}>
                      <Text style={styles.cartLineTitle}>{item.title}</Text>
                      <Text style={styles.cartLineCategory}>{item.category}</Text>
                      <Text style={styles.cartLinePrice}>{fa(item.amount)} تومان</Text>
                      <View style={styles.cartLineControls}>
                        <Pressable accessibilityRole="button" accessibilityLabel={"حذف " + item.title + " از سبد"}
                          onPress={() => setCartItemQuantity(item.id, 0)}>
                          <Text style={styles.cartLineRemove}>حذف</Text>
                        </Pressable>
                        <View style={styles.cartStepper}>
                          <Pressable accessibilityRole="button" accessibilityLabel={"افزایش تعداد " + item.title}
                            onPress={() => setCartItemQuantity(item.id, quantity + 1)} style={styles.cartStepButton}>
                            <Text style={styles.cartStepPlus}>＋</Text>
                          </Pressable>
                          <Text accessibilityLabel={"تعداد " + item.title} style={styles.cartStepValue}>{fa(quantity)}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={"کاهش تعداد " + item.title}
                            onPress={() => setCartItemQuantity(item.id, quantity - 1)} style={styles.cartStepButton}>
                            <Text style={styles.cartStepMinus}>−</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.cartTotalCard}>
              <View style={styles.cartTotalRow}>
                <Text style={styles.cartTotalLabel}>مجموع کالاها</Text>
                <Text style={styles.cartTotalAmount}>{fa(cartTotal)} تومان</Text>
              </View>
              <Text style={styles.cartTotalNotice}>هزینه ارسال پس از انتخاب فروشگاه مشخص می‌شود.</Text>
            </View>
            <View style={styles.cartActions}>
              <Pressable accessibilityRole="button" onPress={() => setCartOpen(false)} style={styles.cartContinueButton}>
                <Text style={styles.cartContinueText}>ادامه خرید</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setCartOpen(false); setCheckoutOpen(true); }} style={styles.checkoutStartButton}>
                <Text style={styles.cartContinueText}>ادامه به تکمیل سفارش</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={onLogin}><Image source={navUser} style={styles.navIcon} accessibilityLabel="حساب" /><Text style={styles.navLabel}>حساب</Text></Pressable>
        <Pressable style={styles.navItem} onPress={onLogin}><Image source={navReceipt} style={styles.navIcon} accessibilityLabel="سفارش‌ها" /><Text style={styles.navLabel}>سفارش‌ها</Text></Pressable>
        <Pressable style={styles.navItem} accessibilityState={{ selected: true }}><Image source={navCart} style={styles.navIcon} accessibilityLabel="سبد خرید" /><Text style={[styles.navLabel, styles.navLabelActive]}>سبد · {fa(cartCount)}</Text></Pressable>
        <Pressable style={styles.navItem} onPress={() => { setCartOpen(false); onHome?.(); }}><Image source={navHome} style={styles.navIcon} accessibilityLabel="خانه" /><Text style={styles.navLabel}>خانه</Text></Pressable>
      </View>
    </SafeAreaView>
  );
  if (checkoutOpen) return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به سبد خرید"
          onPress={() => { setCheckoutOpen(false); setCartOpen(true); }} style={styles.headerBack}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>تکمیل سفارش</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.checkoutScroll}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.cartPageTitle}>تکمیل و ثبت سفارش</Text>
        <View style={styles.checkoutNotice}>
          <Text style={styles.checkoutNoticeTitle}>پیش‌نمایش سفارش</Text>
          <Text style={styles.checkoutNoticeCopy}>این انتخاب فقط در همین صفحه نگه داشته می‌شود. سفارش ثبت یا برای فروشگاه ارسال نمی‌شود.</Text>
        </View>
        <View style={styles.cartTotalCard}>
          <Text style={styles.checkoutSectionTitle}>خلاصه سفارش · {fa(cartCount)} قلم</Text>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.checkoutSummaryRow}>
              <Text style={styles.checkoutSummaryName}>{item.title} × {fa(cart[item.id] ?? 0)}</Text>
              <Text style={styles.checkoutSummaryPrice}>{fa(item.amount * (cart[item.id] ?? 0))} تومان</Text>
            </View>
          ))}
          <View style={styles.checkoutSummaryRow}>
            <Text style={styles.cartTotalLabel}>هزینه ارسال</Text>
            <Text style={styles.checkoutSummaryPrice}>پس از اعلام فروشگاه</Text>
          </View>
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>مبلغ قابل پرداخت</Text>
            <Text style={styles.cartTotalAmount}>{fa(cartTotal)} تومان · قیمت دیده‌شده</Text>
          </View>
        </View>
        <View style={styles.checkoutFormCard}>
          <Text style={styles.checkoutSectionTitle}>آدرس و مشخصات تحویل</Text>
          <Text style={styles.checkoutFieldLabel}>نشانی دقیق پستی</Text>
          <TextInput accessibilityLabel="نشانی دقیق پستی" value={checkoutAddress} onChangeText={setCheckoutAddress}
            placeholder="نشانی دقیق پستی" multiline textAlign="right" style={[styles.checkoutInput, styles.checkoutAddressInput]} />
          <Text style={styles.checkoutFieldLabel}>نام گیرنده</Text>
          <TextInput accessibilityLabel="نام گیرنده" value={checkoutRecipient} onChangeText={setCheckoutRecipient}
            placeholder="نام و نام خانوادگی گیرنده" textAlign="right" style={styles.checkoutInput} />
          <Text style={styles.checkoutFieldLabel}>شماره تماس گیرنده</Text>
          <TextInput accessibilityLabel="شماره تماس گیرنده" value={checkoutPhone} onChangeText={setCheckoutPhone}
            placeholder="۰۹۱۲۳۴۵۶۷۸۹" keyboardType="phone-pad" textAlign="right" style={styles.checkoutInput} />
          <Text style={styles.checkoutHint}>نشانی فقط در این صفحه می‌ماند و ذخیره یا برای فروشگاه ارسال نمی‌شود.</Text>
        </View>
        <View style={styles.checkoutFormCard}>
          <Text style={styles.checkoutSectionTitle}>روش تحویل</Text>
          <Text style={styles.checkoutHint}>زمان تحویل و هزینه ارسال پس از تأیید فروشگاه مشخص می‌شود.</Text>
        </View>
        <View style={styles.checkoutFormCard}>
          <Text style={styles.checkoutSectionTitle}>روش پرداخت</Text>
          <View style={styles.checkoutPayment}>
            <Text style={styles.checkoutPaymentTitle}>پرداخت آنلاین با کارت بانکی</Text>
            <Text style={styles.checkoutHint}>تا اتصال درگاه پرداخت غیرفعال است.</Text>
          </View>
          <Text style={styles.checkoutHint}>پرداخت در محل در حنا پشتیبانی نمی‌شود.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={styles.checkoutBlockedButton}>
          <Text style={styles.cartContinueText}>ثبت سفارش</Text>
        </Pressable>
        <Text style={styles.checkoutBlockedCopy}>ثبت سفارش تا آماده‌شدن API سفارش و درگاه پرداخت فعال نیست.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setCheckoutOpen(false); setCartOpen(true); }} style={styles.checkoutBackButton}>
          <Text style={styles.checkoutBackText}>بازگشت به سبد خرید</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
  if (detailId === "rice") return <FigmaProductDetailScreen
    initialCartQuantity={cart.rice ?? 0}
    onCartQuantityChange={(quantity) => setCartItemQuantity("rice", quantity)}
    onBack={() => setDetailId(null)} />;
  if (detailId !== null) return (
    <BuyerProductDetailScreen key={detailId} id={detailId} catalog={catalog}
      onBack={() => {
        setDetailId(null);
        // A category can leave publication while the buyer reads detail.
        void controller.refreshCategories();
      }} />
  );
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
          {browse.categoryRecovery && categories.status === "ok" ? (
            <View accessibilityRole="alert" style={styles.categoryRecovery}>
              <Text style={styles.categoryRecoveryText}>دسته‌بندی انتخاب‌شده دیگر منتشر نیست؛ کالاهای همه دسته‌ها نمایش داده می‌شوند.</Text>
            </View>
          ) : null}

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

          {cartNotice ? <Text accessibilityLiveRegion="polite" style={styles.cartNotice}>{cartNotice}</Text> : null}

          <View style={styles.productsGrid}>
            {cards.map((item) => (
              <View key={item.id} style={styles.productCard}>
                <Pressable accessibilityRole="button" accessibilityLabel={"جزئیات " + item.title}
                  onPress={() => setDetailId(item.id)} style={styles.productImagePressable}>
                  <Image source={item.image} style={styles.productImage} resizeMode="cover"
                    accessibilityLabel={item.title} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setDetailId(item.id)}
                  style={styles.productTextBlock}>
                  <Text numberOfLines={1} style={styles.productName}>{item.title}</Text>
                  <Text style={styles.productKind}>{item.category}</Text>
                  <Text style={styles.productPrice}>{item.price}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={"افزودن " + item.title + " به سبد"}
                  onPress={() => { setCartItemQuantity(item.id, (cart[item.id] ?? 0) + 1); setCartNotice(item.title + " به سبد اضافه شد."); }}
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
          <Pressable style={styles.navItem} onPress={onHome}>
            <Image source={navHome} style={styles.navIcon} accessibilityLabel="خانه" />
            <Text style={[styles.navLabel, styles.navLabelActive]}>خانه</Text>
          </Pressable>
          <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel={"سبد خرید" + (cartCount > 0 ? "، " + fa(cartCount) + " قلم" : "")} onPress={() => setCartOpen(true)}>
            <Image source={navCart} style={styles.navIcon} accessibilityLabel="سبد خرید" />
            <Text style={styles.navLabel}>سبد{cartCount > 0 ? " · " + fa(cartCount) : ""}</Text>
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
const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  scrollBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100, gap: 8, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f3ed" },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  backIcon: { color: "#0f5b5a", fontSize: 28, lineHeight: 31 },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 16, fontWeight: "700", ...rtl, textAlign: "center" },
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
  productsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
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
  cartScroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 14, backgroundColor: "#f7f3ed" },
  cartHeadingRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cartPageTitle: { color: "#2d2d2d", fontSize: 22, fontWeight: "800", ...rtl },
  cartPageCount: { color: "#8e8e93", fontSize: 13, ...rtl },
  cartEmptyCard: { minHeight: 260, padding: 24, alignItems: "center", justifyContent: "center", gap: 12, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff" },
  cartEmptyIcon: { width: 42, height: 42, tintColor: "#0f5b5a" },
  cartEmptyTitle: { color: "#2d2d2d", fontSize: 18, fontWeight: "800", ...rtl },
  cartEmptyCopy: { color: "#8e8e93", fontSize: 13, lineHeight: 22, textAlign: "center", writingDirection: "rtl" },
  cartLines: { gap: 10 },
  cartLine: { minHeight: 122, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 14, backgroundColor: "#fff" },
  cartLineImage: { width: 76, height: 76, borderRadius: 10, backgroundColor: "#f7f3ed" },
  cartLineCopy: { flex: 1, alignItems: "flex-end", gap: 4 },
  cartLineTitle: { color: "#2d2d2d", fontSize: 13, fontWeight: "700", ...rtl },
  cartLineCategory: { color: "#8e8e93", fontSize: 11, ...rtl },
  cartLinePrice: { color: "#0f5b5a", fontSize: 14, fontWeight: "800", ...rtl },
  cartLineControls: { width: "100%", marginTop: 4, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cartLineRemove: { color: "#b5523b", fontSize: 12, fontWeight: "700", ...rtl },
  cartStepper: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 4, borderRadius: 10, backgroundColor: "#f7f3ed" },
  cartStepButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#fff" },
  cartStepPlus: { color: "#b5523b", fontSize: 16, fontWeight: "700" },
  cartStepMinus: { color: "#706963", fontSize: 16, fontWeight: "700" },
  cartStepValue: { minWidth: 22, color: "#2d2d2d", textAlign: "center", fontSize: 14, fontWeight: "700" },
  cartTotalCard: { padding: 14, gap: 8, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 14, backgroundColor: "#fff" },
  cartTotalRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cartTotalLabel: { color: "#706963", fontSize: 13, ...rtl },
  cartTotalAmount: { color: "#b5523b", fontSize: 18, fontWeight: "800", ...rtl },
  cartTotalNotice: { color: "#8e8e93", fontSize: 11, textAlign: "right", writingDirection: "rtl" },
  cartContinueButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#b5523b" },
  cartContinueText: { color: "#fff", fontSize: 14, fontWeight: "700", ...rtl },
  cartNotice: { color: "#0f5b5a", paddingHorizontal: 10, fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  cartActions: { gap: 8 },
  checkoutStartButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#0f5b5a" },
  checkoutScroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 14, backgroundColor: "#f7f3ed" },
  checkoutNotice: { padding: 14, gap: 6, borderWidth: 1, borderColor: "#e4c9a8", borderRadius: 12, backgroundColor: "#fff8ec" },
  checkoutNoticeTitle: { color: "#8b4a2c", fontSize: 14, fontWeight: "800", ...rtl },
  checkoutNoticeCopy: { color: "#706963", fontSize: 12, lineHeight: 20, ...rtl },
  checkoutSectionTitle: { marginBottom: 6, color: "#2d2d2d", fontSize: 15, fontWeight: "800", ...rtl },
  checkoutSummaryRow: { minHeight: 34, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: "#f0e7dd" },
  checkoutSummaryName: { flex: 1, color: "#706963", fontSize: 11, ...rtl },
  checkoutSummaryPrice: { color: "#2d2d2d", fontSize: 11, fontWeight: "700", ...rtl },
  checkoutFormCard: { padding: 14, gap: 8, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 14, backgroundColor: "#fff" },
  checkoutFieldLabel: { marginTop: 4, color: "#706963", fontSize: 12, fontWeight: "700", ...rtl },
  checkoutInput: { minHeight: 44, paddingHorizontal: 12, color: "#2d2d2d", fontSize: 13, borderWidth: 1, borderColor: "#e8dfd7", borderRadius: 9, backgroundColor: "#fff", ...rtl },
  checkoutAddressInput: { minHeight: 80, paddingTop: 12, textAlignVertical: "top" },
  checkoutHint: { color: "#8e8e93", fontSize: 11, lineHeight: 18, ...rtl },
  checkoutPayment: { padding: 12, gap: 4, borderWidth: 1, borderColor: "#e8dfd7", borderRadius: 9, backgroundColor: "#f7f3ed" },
  checkoutPaymentTitle: { color: "#8e8e93", fontSize: 13, fontWeight: "700", ...rtl },
  checkoutBlockedButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#b9b4ae" },
  checkoutBlockedCopy: { color: "#8e8e93", fontSize: 11, textAlign: "center", writingDirection: "rtl" },
  checkoutBackButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  checkoutBackText: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  categoryRecovery: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#e4c9a8", borderRadius: 10, backgroundColor: "#fff8ec" },
  categoryRecoveryText: { color: "#8b4a2c", fontSize: 12, lineHeight: 19, ...rtl },
});
