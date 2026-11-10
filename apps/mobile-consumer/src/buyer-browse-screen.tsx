import { useEffect, useRef, useState } from "react";
import {
  Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StatusBar, StyleSheet, Text as NativeText, type TextProps, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MobileCatalogClient } from "./mobile-catalog.ts";
import { type BuyerLinkEvent } from "./buyer-link.ts";
import { BuyerProductDetailScreen } from "./buyer-product-detail-screen";
import {
  BROWSE_PAGE_SIZE, BuyerBrowseController, initialBuyerBrowseState,
  type BuyerBrowseState,
} from "./buyer-browse-controller.ts";
import { colors } from "./theme";
import { FigmaIcon } from "./figma-icon";

function Text(props: TextProps) {
  const weight = StyleSheet.flatten(props.style)?.fontWeight;
  const family = weight === "800" || weight === "900" ? "Estedad_800ExtraBold"
    : weight === "600" ? "Estedad_600SemiBold"
      : weight === "700" || weight === "bold" ? "Estedad_700Bold"
      : "Estedad_400Regular";
  return <NativeText {...props} style={[{ fontFamily: family }, props.style]} />;
}

const logo = require("../assets/figma/logo-badge.png");
const hero = require("../assets/figma/hero-card.jpg");
const categoryArt = [
  require("../assets/figma/category-1.jpg"),
  require("../assets/figma/category-2.jpg"),
  require("../assets/figma/category-3.jpg"),
  require("../assets/figma/category-4.jpg"),
];
function categoryImage(name: string, index: number) {
  const key = name.replace(/\s/g, "");
  if (/لبنی|شیر|ماست/.test(key)) return categoryArt[0];
  if (/خواربار|روغن|غلات|حبوب/.test(key)) return categoryArt[1];
  if (/نوشیدنی|آبمیوه|چای/.test(key)) return categoryArt[2];
  if (/پروتئین|گوشت|مرغ|ماهی/.test(key)) return categoryArt[3];
  return categoryArt[index % categoryArt.length];
}

/**
 * Visual-only examples from approved review frame 194:4.
 * No catalog IDs, seller offers, inventory, authenticated session or cart mutations.
 * Only used by the explicitly enabled offline browser preview.
 */
const homeDesignProducts = [
  { name: "چای سیاه", category: "نوشیدنی", badge: "طرح ویژه", price: "۳۴,۰۰۰ تومان", oldPrice: "", image: require("../assets/figma/home-product-5.jpg") },
  { name: "روغن مایع آفتابگردان", category: "خواربار", badge: "٪ تخفیف", price: "۶۸,۰۰۰ تومان", oldPrice: "۷۹,۰۰۰", image: require("../assets/figma/home-product-4.jpg") },
  { name: "برنج طارم ایرانی", category: "خواربار", badge: "کالابرگ", price: "۱۸۵,۰۰۰ تومان", oldPrice: "", image: require("../assets/figma/home-product-3.jpg") },
  { name: "ماست کم‌چرب", category: "لبنیات", badge: "کالابرگ", price: "۱۲,۰۰۰ تومان", oldPrice: "", image: require("../assets/figma/home-product-2.jpg") },
  { name: "پنیر سفید صبحانه", category: "لبنیات", badge: "طرح ویژه", price: "۴۵,۰۰۰ تومان", oldPrice: "۵۲,۰۰۰", image: require("../assets/figma/home-product-1.jpg") },
] as const;
const homeDesignCategories = ["لبنیات", "خواربار", "نوشیدنی", "پروتئینی"] as const;

const catalog = new MobileCatalogClient(
  process.env.EXPO_PUBLIC_HANA_API_BASE_URL, fetch, __DEV__,
);

/** Buyer home follows Figma frame 194:4 while catalog identities remain API-backed. */
export function BuyerBrowseScreen({ onLogin, onLogout, onIssues, onOrders, onSupport, onWallet, onCart, active=true, isSignedIn=false, previewSession=false, link }: {
  onIssues:()=>void; onOrders:()=>void; onSupport:()=>void; onWallet:()=>void; active?:boolean; isSignedIn?:boolean; previewSession?:boolean; onLogin: () => void; onLogout: () => void; onCart: (productId?:string)=>void; link: BuyerLinkEvent;
}) {
  const [detailId, setDetailId] = useState<string | null>(link.route.kind === "detail" ? link.route.id : null);
  const [browse, setBrowse] = useState<BuyerBrowseState>(() => initialBuyerBrowseState(link.route.browse));
  const [controller] = useState(() => new BuyerBrowseController(catalog, setBrowse, link.route.browse));
  const lastLink = useRef(link.token);
  const [draftSearch, setDraftSearch] = useState(link.route.browse.search);
  const [searchError, setSearchError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const designPreview = Platform.OS === "web" && previewSession &&
    process.env.EXPO_PUBLIC_HANA_DEMO_LOGIN === "true" && !process.env.EXPO_PUBLIC_HANA_API_BASE_URL;
  const [designQuery, setDesignQuery] = useState("");
  const [designCategory, setDesignCategory] = useState<string | null>(null);
  const [designBadge, setDesignBadge] = useState<string | null>(null);
  const designProducts = homeDesignProducts.filter(product =>
    (!designQuery || product.name.includes(designQuery) || product.category.includes(designQuery)) &&
    (!designCategory || product.category === designCategory) &&
    (!designBadge || product.badge === designBadge));
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!active) { controller.stop(); return; }
    controller.start();
    return () => controller.stop();
  }, [active, controller]);

  useEffect(() => {
    if (lastLink.current === link.token) return;
    lastLink.current = link.token;
    controller.restoreLocation(link.route.browse);
    setDraftSearch(link.route.browse.search);
    setSearchError("");
    setDetailId(link.route.kind === "detail" ? link.route.id : null);
  }, [controller, link]);

  function search() {
    if (designPreview) {
      const query = draftSearch.trim();
      if (query.length > 80 || /[\u0000-\u001f\u007f]/.test(query)) {
        setSearchError("جست‌وجو باید حداکثر ۸۰ نویسه و بدون نویسهٔ کنترلی باشد.");
        return;
      }
      setDesignQuery(query);
      setSearchError("");
      return;
    }
    if (!controller.submitSearch(draftSearch)) {
      setSearchError("جست‌وجو باید حداکثر ۸۰ نویسه و بدون نویسهٔ کنترلی باشد.");
      return;
    }
    setSearchError("");
  }

  if (detailId !== null) return (
    <BuyerProductDetailScreen key={detailId} id={detailId} active={active} catalog={catalog} onCart={onCart}
      onBack={() => { setDetailId(null); void controller.refreshCategories(); }} />
  );

  const categories = browse.categories;
  const products = browse.products;
  const openAccountAction = (action: () => void) => {
    setAccountMenuOpen(false);
    action();
  };
  const onAccount = isSignedIn ? onLogout : onLogin;
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={onSupport} accessibilityRole="button" accessibilityLabel="اعلان‌ها و پشتیبانی" style={styles.bellButton}>
              <FigmaIcon name="bell" size={20} />
            </Pressable>
            <View style={styles.greeting}>
              <Text style={styles.greetingEyebrow}>سلام، روزت بخیر</Text>
              <Text style={styles.greetingTitle}>به حنا خوش آمدید</Text>
            </View>
            <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
          </View>

          {previewSession && !designPreview ? <Text style={styles.previewNotice}>ورود آزمایشی · کاتالوگ عمومی</Text> : null}

          <View style={styles.searchRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="فیلترهای جست‌وجو" style={styles.searchTool}>
              <FigmaIcon name="sliders" size={18} color="#8E8E93" />
            </Pressable>
            <TextInput accessibilityLabel="جست‌وجو در نام کالاها" style={styles.searchInput}
              placeholder="جست‌وجوی کالا یا دسته..." placeholderTextColor="#8E8E93"
              textAlign="right" returnKeyType="search" maxLength={80} value={draftSearch}
              onChangeText={(value) => { setDraftSearch(value); setSearchError(""); }} onSubmitEditing={search} />
            <Pressable accessibilityRole="button" accessibilityLabel="جست‌وجو" onPress={search} style={styles.searchButton}>
              <FigmaIcon name="search" size={20} />
            </Pressable>
          </View>
          {searchError ? <Text accessibilityRole="alert" style={styles.searchError}>{searchError}</Text> : null}

          <View style={styles.filters}>
            {([["طرح ویژه", "طرح ویژه  🔥"], ["کالابرگ", "✓  کالابرگ"], ["٪ تخفیف", "٪  تخفیف‌دار"]] as const).map(([badge, label]) => {
              const selected = (designBadge ?? "کالابرگ") === badge;
              return designPreview ? <Pressable key={badge} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setDesignBadge(current => current === badge ? null : badge)} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable> : <View key={badge} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></View>;
            })}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="مشاهده تخفیف‌ها و طرح‌ها"
            onPress={() => scroll.current?.scrollTo({ y: 440, animated: true })} style={styles.heroCard}>
            <Image source={hero} resizeMode="cover" style={styles.heroImage} />
            <View style={styles.heroShade} />
            <Text style={styles.heroTitle}>خرید روزمره، با اثری فراتر از خرید</Text>
            <Text style={styles.heroCopy}>کالاها و نیازهای خود را انتخاب کن؛ حنا مناسب‌ترین گزینه‌های نزدیک را برایت پیدا می‌کند و مقایسه می‌کند.</Text>
            <View style={styles.heroBottom}>
              <View style={styles.heroArrow}><FigmaIcon name="arrow-left" size={18} /></View>
              <View style={styles.heroCta}><Text style={styles.heroCtaText}>تخفیف‌ها و طرح‌ها</Text></View>
            </View>
          </Pressable>

          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>انتخابت را کامل کن؛ حنا گزینه‌های نزدیک را برایت مقایسه می‌کند.</Text>
            <View style={styles.infoIcon}><FigmaIcon name="info" size={20} /></View>
          </View>

          <View style={styles.sectionHeadingRow}>
            <Pressable onPress={() => { if (designPreview) { setDesignBadge(null); setDesignCategory(null); setDesignQuery(""); setDraftSearch(""); } scroll.current?.scrollTo({ y: 440, animated: true }); }}><Text style={styles.sectionLink}>همه پیشنهادها</Text></Pressable>
            <Text accessibilityLabel="کالاها را در حنا مرور کنید" style={styles.sectionHeading}>پیشنهادهای امروز</Text>
          </View>
          {designPreview ? (
            <>
              <Text accessibilityLabel="پیش‌نمایش طراحی؛ محصولات و قیمت‌ها نمونه هستند و خرید واقعی فعال نیست" style={styles.designNotice}>پیش‌نمایش طراحی · قیمت‌ها نمونه‌اند؛ خرید واقعی فعال نیست</Text>
              {designProducts.length === 0 ? <View style={styles.emptyProducts}><Text style={styles.emptyTitle}>نمونه‌ای برای این انتخاب وجود ندارد</Text><Pressable onPress={() => { setDesignBadge(null); setDesignCategory(null); setDesignQuery(""); setDraftSearch(""); }}><Text style={styles.sectionLink}>نمایش همه نمونه‌ها</Text></Pressable></View> :
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.designRailViewport} contentContainerStyle={styles.designProductRail}>
                {designProducts.map(product => <View key={product.name} style={styles.designProductCard} accessibilityLabel={product.name + "، نمونه طراحی"}>
                  <View style={styles.designProductImageWrap}><Image source={product.image} resizeMode="cover" style={styles.designProductImage}/><View style={styles.designBadge}><Text style={styles.designBadgeText}>{product.badge}</Text></View></View>
                  <View style={styles.designProductText}><Text style={styles.designProductName} numberOfLines={2}>{product.name}</Text><Text style={styles.designPrice}>{product.price}</Text><Text style={styles.designOldPrice}>{product.oldPrice || " "}</Text></View>
                  <View accessibilityRole="button" accessibilityState={{disabled:true}} accessibilityLabel="افزودن، در پیش‌نمایش غیرفعال" style={styles.designAddButton}><FigmaIcon name="plus" size={12}/><Text style={styles.addButtonText}> افزودن</Text></View>
                </View>)}
              </ScrollView>}
            </>
          ) : products.status === "loading" ? (
            <View style={styles.emptyProducts}><Text style={styles.emptyText}>در حال دریافت پیشنهادها…</Text></View>
          ) : products.status === "unavailable" ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyText}>پیشنهادها در دسترس نیستند.</Text>
              <Pressable onPress={() => void controller.refreshProducts()} style={styles.retryButton}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable>
            </View>
          ) : products.data.items.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyTitle}>هنوز کالایی برای نمایش نداریم</Text>
              <Text style={styles.emptyText}>{browse.search || browse.categoryId ? "در این جست‌وجو کالای منتشرشده‌ای پیدا نشد." : "کالاهای منتشرشدهٔ حنا بعد از اتصال کاتالوگ اینجا نمایش داده می‌شوند."}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
              {products.data.items.map((product) => (
                <Pressable key={product.id} style={styles.productCard} accessibilityRole="button"
                  accessibilityLabel={`جزئیات ${product.name}`} onPress={() => setDetailId(product.id)}>
                  <View style={styles.productImagePlaceholder}><Text style={styles.productPlaceholderGlyph}>✿</Text></View>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productKind}>{product.kind === "SERVICE" ? "خدمت" : "کالا"}</Text>
                  <Pressable onPress={(event) => { event.stopPropagation(); onCart(product.id); }} style={styles.addButton}><FigmaIcon name="plus" size={12} /><Text style={styles.addButtonText}> افزودن</Text></Pressable>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.sectionHeadingRow}>
            <Pressable onPress={() => designPreview ? setDesignCategory(null) : controller.chooseCategory(null)}><Text style={styles.sectionLink}>مشاهده همه</Text></Pressable>
            <Text style={styles.sectionHeading}>دسته‌بندی‌های محبوب</Text>
          </View>
          {designPreview ? (
            <View style={styles.designCategoryRail}>{homeDesignCategories.map((name,index) => <Pressable key={name} accessibilityRole="button" accessibilityLabel={name + "، دسته نمونه"} accessibilityState={{selected:designCategory===name}} onPress={() => { setDesignCategory(current=>current===name?null:name); setDesignBadge(null); }} style={styles.designCategoryItem}><Image source={categoryArt[index]} resizeMode="cover" style={[styles.categoryImage, designCategory===name && styles.designCategorySelected]}/><Text style={styles.categoryName}>{name}</Text></Pressable>)}</View>
          ) : categories.status === "loading" ? <Text style={styles.categoryNotice}>در حال دریافت دسته‌بندی‌ها…</Text>
            : categories.status === "unavailable" ? (
              <View style={styles.categoryUnavailable}>
                <Text style={styles.categoryNotice}>دسته‌بندی‌ها در دسترس نیستند.</Text>
                <Pressable onPress={() => void controller.refreshCategories()}><Text style={styles.sectionLink}>تلاش دوباره</Text></Pressable>
              </View>
            ) : categories.data.length === 0 ? (
              <View style={styles.categoryUnavailable}><Text style={styles.categoryNotice}>هنوز دسته‌بندی قابل نمایشی نداریم.</Text></View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
                {categories.data.slice(0, 8).map((category, index) => (
                  <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={category.name}
                    accessibilityState={{ selected: browse.categoryId === category.id }}
                    onPress={() => controller.chooseCategory(category.id)} style={styles.categoryItem}>
                    <Image source={categoryImage(category.name, index)} style={styles.categoryImage} />
                    <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

          {browse.categoryRecovery && categories.status === "ok" ? <Text accessibilityRole="alert" style={styles.categoryRecovery}>دسته‌بندی انتخاب‌شده دیگر منتشر نیست؛ همهٔ دسته‌ها نمایش داده می‌شوند.</Text> : null}
          {(designPreview ? designQuery : browse.search) ? <Pressable onPress={() => { setDraftSearch(""); if (designPreview) setDesignQuery(""); else controller.submitSearch(""); }} style={styles.clearSearch}><Text style={styles.sectionLink}>پاک کردن جست‌وجو</Text></Pressable> : null}
        </ScrollView>
        <View style={styles.bottomNav}>
          <Pressable onPress={() => setAccountMenuOpen(true)} accessibilityRole="button" accessibilityLabel="حساب" style={[styles.navItem, styles.navInactive]}><FigmaIcon name="user" size={22} color="#8E8E93" /><Text style={styles.navLabel}>حساب</Text></Pressable>
          <Pressable onPress={onOrders} accessibilityRole="button" accessibilityLabel="سفارش‌های من" style={[styles.navItem, styles.navInactive]}><FigmaIcon name="receipt" size={22} color="#8E8E93" /><Text style={styles.navLabel}>سفارش‌ها</Text></Pressable>
          <Pressable onPress={() => onCart()} accessibilityRole="button" accessibilityLabel="سبد خرید" style={[styles.navItem, styles.navInactive]}><FigmaIcon name="cart" size={22} color="#8E8E93" /><Text style={styles.navLabel}>سبد</Text></Pressable>
          <View style={styles.navItem}><FigmaIcon name="home" size={22} color={colors.teal} /><Text style={styles.navLabel}>خانه</Text></View>
        </View>
        <Modal visible={accountMenuOpen} transparent animationType="slide" onRequestClose={() => setAccountMenuOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAccountMenuOpen(false)}>
            <View style={styles.accountSheet}>
              <View style={styles.sheetHandle} />
              <Text accessibilityRole="header" style={styles.accountHeading}>حساب کاربری</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="گزارش‌ها و مرجوعی‌های من" onPress={() => openAccountAction(onIssues)} style={styles.accountAction}><Text style={styles.accountActionText}>گزارش‌ها و مرجوعی‌های من</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="کیف پول" onPress={() => openAccountAction(onWallet)} style={styles.accountAction}><Text style={styles.accountActionText}>کیف پول</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="اعلان‌ها و پشتیبانی" onPress={() => openAccountAction(onSupport)} style={styles.accountAction}><Text style={styles.accountActionText}>اعلان‌ها و پشتیبانی</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={isSignedIn ? "خروج از حساب" : "ورود به حنا"} onPress={() => openAccountAction(onAccount)} style={[styles.accountAction, styles.accountLogout]}><Text style={[styles.accountActionText, styles.accountLogoutText]}>{isSignedIn ? "خروج از حساب" : "ورود به حنا"}</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const styles = StyleSheet.create({
  fill: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.cream },
  scrollBody: { flexGrow: 1, paddingBottom: 18, backgroundColor: colors.cream },
  header: { height: 63, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bellButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F0E7DD", alignItems: "center", justifyContent: "center" },
  greeting: { flex: 1, alignItems: "flex-end", paddingRight: 16 },
  greetingEyebrow: { color: "#8E8E93", fontSize: 11, ...rtl }, greetingTitle: { color: colors.charcoal, fontSize: 12, fontWeight: "700", ...rtl },
  logo: { width: 119, height: 47 }, previewNotice: { marginHorizontal: 20, color: colors.teal, backgroundColor: colors.paleTeal, padding: 8, borderRadius: 8, fontSize: 11, ...rtl },
  searchRow: { height: 46, marginHorizontal: 20, marginTop: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#F0E7DD", borderRadius: 13, backgroundColor: colors.surface, paddingHorizontal: 12 },
  searchTool: { width: 28, alignItems: "center" },
  searchInput: { flex: 1, minWidth: 0, color: colors.charcoal, fontSize: 13, paddingHorizontal: 10, ...rtl },
  searchButton: { width: 28, alignItems: "center" },
  searchError: { marginHorizontal: 22, marginTop: 4, color: colors.error, fontSize: 11, ...rtl },
  filters: { height: 56, paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  filterChip: { backgroundColor: colors.surface, borderColor: "#F0E7DD", borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, height: 34, justifyContent: "center" },
  filterChipActive: { backgroundColor: colors.teal, borderColor: colors.teal }, filterText: { color: colors.charcoal, fontSize: 12, fontWeight: "600" }, filterTextActive: { color: colors.surface },
  heroCard: { height: 158, marginHorizontal: 20, marginTop: 1, borderRadius: 20, overflow: "hidden", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, justifyContent: "space-between", elevation: 4, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  heroImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined }, heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15,91,90,0.85)" },
  heroTitle: { color: colors.surface, fontSize: 20, lineHeight: 28, fontWeight: "800", ...rtl }, heroCopy: { color: colors.surface, fontSize: 13, lineHeight: 20, ...rtl },
  heroBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, heroArrow: { backgroundColor: colors.surface, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroCta: { backgroundColor: colors.terracotta, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 }, heroCtaText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
  infoBanner: { minHeight: 64, marginHorizontal: 20, marginTop: 20, backgroundColor: "#E7F3F2", borderWidth: 1, borderColor: colors.teal, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { flex: 1, color: colors.teal, fontSize: 13, lineHeight: 20, fontWeight: "600", ...rtl }, infoIcon: { width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sectionHeadingRow: { marginTop: 20, paddingHorizontal: 20, height: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionHeading: { color: colors.charcoal, fontSize: 15, fontWeight: "800", ...rtl }, sectionLink: { color: colors.terracotta, fontSize: 11, fontWeight: "700", ...rtl },
  emptyProducts: { minHeight: 128, marginTop: 9, marginHorizontal: 20, padding: 14, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: "#F0E7DD", justifyContent: "center", gap: 5 },
  emptyTitle: { color: colors.charcoal, fontSize: 13, fontWeight: "700", ...rtl }, emptyText: { color: "#8E8E93", fontSize: 11, lineHeight: 18, ...rtl },
  retryButton: { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 7, marginTop: 6, borderColor: colors.teal, borderWidth: 1, borderRadius: 8 }, retryText: { color: colors.teal, fontSize: 11, fontWeight: "700" },
  productRail: { gap: 10, paddingHorizontal: 20, paddingTop: 9, flexDirection: "row-reverse" }, productCard: { width: 138, minHeight: 208, backgroundColor: colors.surface, borderRadius: 15, padding: 8, alignItems: "stretch", elevation: 2, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  productImagePlaceholder: { height: 104, borderRadius: 10, backgroundColor: "#F3EADF", alignItems: "center", justifyContent: "center" }, productPlaceholderGlyph: { color: colors.terracotta, fontSize: 30 }, productName: { minHeight: 36, marginTop: 7, color: colors.charcoal, fontSize: 12, fontWeight: "700", ...rtl }, productKind: { color: colors.teal, fontSize: 10, marginTop: 2, ...rtl },
  addButton: { height: 31, borderWidth: 1, borderColor: colors.terracotta, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 7 }, addButtonText: { color: colors.terracotta, fontSize: 11, fontWeight: "700" },
  categoryRail: { gap: 18, paddingHorizontal: 25, paddingTop: 12, paddingBottom: 16, flexDirection: "row-reverse" }, categoryItem: { width: 70, alignItems: "center", gap: 6 }, categoryImage: { width: 64, height: 64, borderRadius: 32 }, categoryName: { color: colors.teal, fontSize: 14, fontWeight: "700", maxWidth: 70, ...rtl },
  categoryNotice: { color: "#8E8E93", fontSize: 11, paddingHorizontal: 20, paddingTop: 12, ...rtl }, categoryUnavailable: { minHeight: 90, justifyContent: "center", gap: 8 }, categoryRecovery: { marginHorizontal: 20, marginTop: 8, color: colors.teal, fontSize: 11, ...rtl }, clearSearch: { padding: 20, alignItems: "flex-end" },
  bottomNav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#EFEAE3", flexDirection: "row", justifyContent: "space-around" }, navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }, navInactive: { opacity: 0.55 }, navLabel: { color: colors.teal, fontSize: 10, ...rtl },
  designNotice: { marginHorizontal: 20, marginTop: 4, color: colors.teal, fontSize: 10, ...rtl },
  designRailViewport: { direction: "rtl" },
  designProductRail: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 6 },
  designProductCard: { width: 140, height: 240, backgroundColor: colors.surface, borderRadius: 16, padding: 12, justifyContent: "space-between", borderWidth: 1, borderColor: "#F0E7DD", elevation: 2, shadowColor: "#000", shadowOpacity: 0.09, shadowRadius: 4, shadowOffset: { width: 0, height: 3 } },
  designProductImageWrap: { width: 116, height: 100, borderRadius: 11, overflow: "hidden", position: "relative" },
  designProductImage: { width: 116, height: 100 },
  designBadge: { position: "absolute", right: 4, top: 4, backgroundColor: colors.terracotta, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  designBadgeText: { color: colors.surface, fontSize: 10, fontWeight: "700", ...rtl },
  designProductText: { flex: 1, justifyContent: "flex-end", paddingBottom: 6 },
  designProductName: { fontSize: 12, lineHeight: 18, fontWeight: "700", color: colors.charcoal, ...rtl },
  designPrice: { fontSize: 12, lineHeight: 18, fontWeight: "700", color: colors.teal, ...rtl },
  designOldPrice: { fontSize: 10, lineHeight: 14, color: "#8E8E93", textDecorationLine: "line-through", ...rtl },
  designAddButton: { minHeight: 32, borderWidth: 1, borderColor: colors.terracotta, backgroundColor: "#FBF0EB", borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  designCategoryRail: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  designCategoryItem: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
  designCategorySelected: { borderWidth: 2, borderColor: colors.teal },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(35,31,28,0.28)" }, accountSheet: { backgroundColor: colors.cream, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10 }, sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 3, backgroundColor: "#D5CFC8", marginBottom: 6 }, accountHeading: { color: colors.charcoal, fontSize: 17, fontWeight: "800", marginBottom: 2, ...rtl }, accountAction: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, justifyContent: "center" }, accountActionText: { color: colors.charcoal, fontSize: 13, fontWeight: "600", ...rtl }, accountLogout: { backgroundColor: colors.paleTeal }, accountLogoutText: { color: colors.teal, fontWeight: "700" },
});
